-- SawariBuddy: read RPCs. They expose exactly the columns each screen needs (e.g. passengers never
-- see driver phone numbers or other drivers' locations), with server-computed availability.

-- Bookable trips for a route: OPEN, driver reachable, seats left.
create function public.search_trips(p_origin_stop_id uuid, p_destination_stop_id uuid)
returns table (
  trip_id            uuid,
  route_id           uuid,
  auto_registration  text,
  auto_model         text,
  auto_colour        text,
  driver_first_name  text,
  fare_paise         bigint,
  capacity           smallint,
  available_seats    integer,
  driver_lat         double precision,
  driver_lng         double precision,
  location_at        timestamptz,
  opened_at          timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.route_id, a.registration_number, a.model, a.colour,
         split_part(p.full_name, ' ', 1),
         t.fare_paise, t.capacity, t.capacity - occ.seats,
         dp.lat, dp.lng, dp.location_at, t.opened_at
    from public.routes r
    join public.trips t on t.route_id = r.id and t.status = 'OPEN'
    join public.autos a on a.id = t.auto_id and a.status = 'ACTIVE'
    join public.profiles p on p.id = t.driver_id
    join public.driver_presence dp on dp.driver_id = t.driver_id
    cross join lateral (select private.trip_occupied_seats(t.id) as seats) occ
   where (select auth.uid()) is not null
     and r.origin_stop_id = p_origin_stop_id
     and r.destination_stop_id = p_destination_stop_id
     and r.is_active
     and private.driver_is_reachable(t.driver_id)
     and t.capacity - occ.seats > 0
   order by t.opened_at;
$$;

-- The caller's current booking (CONFIRMED/BOARDED) with trip, auto, driver and live presence. Null if none.
create function public.get_my_active_booking()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'booking', to_jsonb(b),
           'trip', jsonb_build_object(
             'id', t.id, 'status', t.status, 'capacity', t.capacity,
             'available_seats', t.capacity - private.trip_occupied_seats(t.id),
             'final_call_at', t.final_call_at, 'no_show_eligible_at', t.no_show_eligible_at,
             'started_at', t.started_at),
           'route', jsonb_build_object('id', r.id, 'origin', o.name, 'destination', d.name, 'fare_paise', r.fare_paise),
           'auto', jsonb_build_object('registration_number', a.registration_number, 'model', a.model, 'colour', a.colour),
           'driver', jsonb_build_object(
             'first_name', split_part(p.full_name, ' ', 1),
             'reachable', private.driver_is_reachable(t.driver_id),
             'last_seen_at', dp.last_seen_at,
             'lat', dp.lat, 'lng', dp.lng, 'location_at', dp.location_at))
    from public.bookings b
    join public.trips t on t.id = b.trip_id
    join public.routes r on r.id = t.route_id
    join public.stops o on o.id = r.origin_stop_id
    join public.stops d on d.id = r.destination_stop_id
    join public.autos a on a.id = t.auto_id
    join public.profiles p on p.id = t.driver_id
    left join public.driver_presence dp on dp.driver_id = t.driver_id
   where b.passenger_id = (select auth.uid())
     and b.status in ('CONFIRMED', 'BOARDED');
$$;

-- Driver's (or admin's) view of one trip: occupancy and every occupant, passenger first names only.
create function public.get_trip_manifest(p_trip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_trip public.trips;
  v_occupied integer;
begin
  select * into v_trip from public.trips where id = p_trip_id;
  if not found or not (v_trip.driver_id = (select auth.uid()) or private.is_admin()) then
    perform private.raise_error('TRIP_NOT_FOUND');
  end if;
  v_occupied := private.trip_occupied_seats(p_trip_id);
  return jsonb_build_object(
    'trip', to_jsonb(v_trip),
    'occupied_seats', v_occupied,
    'available_seats', v_trip.capacity - v_occupied,
    'no_show_allowed', v_trip.status = 'BOARDING' and now() >= v_trip.no_show_eligible_at,
    'server_time', now(),
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'code', b.code, 'source', b.source, 'status', b.status,
               'seat_count', b.seat_count, 'seat_preference', b.seat_preference,
               'passenger_first_name', split_part(p.full_name, ' ', 1),
               'walk_in_label', b.walk_in_label, 'total_fare_paise', b.total_fare_paise,
               'created_at', b.created_at, 'boarded_at', b.boarded_at)
             order by b.created_at)
        from public.bookings b
        left join public.profiles p on p.id = b.passenger_id
       where b.trip_id = p_trip_id), '[]'::jsonb));
end;
$$;

-- Settings clients need (heartbeat interval, limits). Not the commission internals.
create function public.get_platform_settings_public()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'max_seats_per_booking', s.max_seats_per_booking,
    'no_show_grace_seconds', s.no_show_grace_seconds,
    'driver_stale_seconds', s.driver_stale_seconds,
    'location_update_interval_seconds', s.location_update_interval_seconds)
    from public.platform_settings s
   where s.id = 1 and (select auth.uid()) is not null;
$$;

-- Earnings for [p_from, p_to) (default: from the start of today in India time, no upper bound)
-- plus the current settlement balance.
-- Drivers see their own; admins may pass any driver id.
create function public.driver_earnings_summary(p_from timestamptz default null,
                                               p_to timestamptz default null,
                                               p_driver_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_driver uuid;
  v_from timestamptz := coalesce(p_from, date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata');
  v_to timestamptz := coalesce(p_to, 'infinity'::timestamptz);
  v_account uuid;
begin
  if private.is_admin() then
    v_driver := p_driver_id;
    if v_driver is null then perform private.raise_error('DRIVER_ID_REQUIRED'); end if;
  else
    v_driver := private.require_role('DRIVER');
    if p_driver_id is not null and p_driver_id <> v_driver then
      perform private.raise_error('NOT_AUTHORISED');
    end if;
  end if;

  select id into v_account from public.ledger_accounts where type = 'DRIVER_SETTLEMENT' and owner_profile_id = v_driver;

  return jsonb_build_object(
    'driver_id', v_driver,
    'from', v_from,
    'to', v_to,
    'earnings_paise', coalesce((
      select sum(e.amount_paise) from public.ledger_entries e
       where e.account_id = v_account and e.entry_type = 'DRIVER_EARNING'
         and e.created_at >= v_from and e.created_at < v_to), 0),
    'fares_collected_paise', coalesce((
      select -sum(e.amount_paise) from public.ledger_entries e
       where e.account_id = v_account and e.entry_type = 'PAYMENT'
         and e.created_at >= v_from and e.created_at < v_to), 0),
    'completed_trips', (
      select count(*) from public.trips t
       where t.driver_id = v_driver and t.status = 'COMPLETED'
         and t.completed_at >= v_from and t.completed_at < v_to),
    -- negative = driver owes the platform (cash model); positive = platform owes the driver
    'settlement_balance_paise', coalesce((
      select sum(e.amount_paise) from public.ledger_entries e where e.account_id = v_account), 0));
end;
$$;
