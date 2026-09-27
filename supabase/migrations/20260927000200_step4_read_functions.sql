-- SawariBuddy Phase 2 Step 4: additional read functions for mobile screens.
--
-- get_my_booking_history  — passenger's paginated booking history (all statuses)
-- get_my_booking          — single booking detail for the owning passenger
-- get_driver_home         — driver dashboard: presence, active trip, auto, today's earnings

-- ---------------------------------------------------------------------------
-- Passenger: booking history (cursor-paginated, newest first)
-- Uses the existing index: bookings_passenger_history_idx (passenger_id, created_at desc)
-- ---------------------------------------------------------------------------
create function public.get_my_booking_history(
  p_limit  integer default 20,
  p_before timestamptz default null   -- pass the last row's created_at for the next page
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_limit integer := least(greatest(p_limit, 1), 50);  -- clamp 1..50
begin
  if v_uid is null then
    perform private.raise_error('NOT_AUTHORISED');
  end if;

  return coalesce((
    select jsonb_agg(row_obj order by created_at desc)
    from (
      select jsonb_build_object(
               'id', b.id,
               'code', b.code,
               'status', b.status,
               'source', b.source,
               'seat_count', b.seat_count,
               'total_fare_paise', b.total_fare_paise,
               'created_at', b.created_at,
               'completed_at', b.completed_at,
               'cancelled_at', b.cancelled_at,
               'no_show_at', b.no_show_at,
               'origin', o.name,
               'destination', d.name,
               'driver_first_name', split_part(p.full_name, ' ', 1),
               'auto_registration', a.registration_number
             ) as row_obj,
             b.created_at,
             b.id as booking_id
        from public.bookings b
        join public.trips t on t.id = b.trip_id
        join public.routes r on r.id = t.route_id
        join public.stops o on o.id = r.origin_stop_id
        join public.stops d on d.id = r.destination_stop_id
        join public.autos a on a.id = t.auto_id
        join public.profiles p on p.id = t.driver_id
       where b.passenger_id = v_uid
         and (p_before is null or b.created_at < p_before)
       order by b.created_at desc, b.id desc
       limit v_limit
    ) sub
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Passenger: single booking with full trip/route/driver/auto details
-- ---------------------------------------------------------------------------
create function public.get_my_booking(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    perform private.raise_error('NOT_AUTHORISED');
  end if;

  return (
    select jsonb_build_object(
             'booking', jsonb_build_object(
               'id', b.id, 'code', b.code, 'status', b.status, 'source', b.source,
               'seat_count', b.seat_count, 'seat_preference', b.seat_preference,
               'total_fare_paise', b.total_fare_paise, 'fare_per_seat_paise', b.fare_per_seat_paise,
               'platform_fee_paise', b.platform_fee_paise, 'payment_method', b.payment_method,
               'created_at', b.created_at, 'boarded_at', b.boarded_at,
               'completed_at', b.completed_at, 'cancelled_at', b.cancelled_at,
               'cancel_reason', b.cancel_reason, 'no_show_at', b.no_show_at),
             'trip', jsonb_build_object(
               'id', t.id, 'status', t.status, 'capacity', t.capacity,
               'available_seats', t.capacity - private.trip_occupied_seats(t.id),
               'final_call_at', t.final_call_at, 'no_show_eligible_at', t.no_show_eligible_at,
               'started_at', t.started_at, 'completed_at', t.completed_at),
             'route', jsonb_build_object(
               'id', r.id, 'origin', o.name, 'destination', d.name, 'fare_paise', r.fare_paise),
             'auto', jsonb_build_object(
               'registration_number', a.registration_number, 'model', a.model, 'colour', a.colour),
             'driver', jsonb_build_object(
               'first_name', split_part(p.full_name, ' ', 1),
               'reachable', private.driver_is_reachable(t.driver_id),
               'lat', dp.lat, 'lng', dp.lng, 'location_at', dp.location_at))
      from public.bookings b
      join public.trips t on t.id = b.trip_id
      join public.routes r on r.id = t.route_id
      join public.stops o on o.id = r.origin_stop_id
      join public.stops d on d.id = r.destination_stop_id
      join public.autos a on a.id = t.auto_id
      join public.profiles p on p.id = t.driver_id
      left join public.driver_presence dp on dp.driver_id = t.driver_id
     where b.id = p_booking_id
       and b.passenger_id = v_uid
  );
  -- Returns NULL if the booking doesn't exist or doesn't belong to the caller.
end;
$$;

-- ---------------------------------------------------------------------------
-- Driver: dashboard (presence, active trip + manifest, auto, today's earnings)
-- ---------------------------------------------------------------------------
create function public.get_driver_home()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_driver uuid;
  v_presence record;
  v_trip    public.trips;
  v_auto    record;
  v_manifest jsonb;
  v_occupied integer;
  v_earnings jsonb;
begin
  -- Must be an active driver.
  v_driver := private.require_active_driver();

  -- Presence
  select dp.is_online, dp.active_trip_id, dp.lat, dp.lng, dp.location_at, dp.last_seen_at
    into v_presence
    from public.driver_presence dp
   where dp.driver_id = v_driver;

  -- Active trip (if any) with simplified manifest
  if v_presence.active_trip_id is not null then
    select * into v_trip from public.trips where id = v_presence.active_trip_id;
    if found then
      v_occupied := private.trip_occupied_seats(v_trip.id);
      v_manifest := jsonb_build_object(
        'trip', jsonb_build_object(
          'id', v_trip.id, 'status', v_trip.status, 'capacity', v_trip.capacity,
          'fare_paise', v_trip.fare_paise,
          'final_call_at', v_trip.final_call_at, 'no_show_eligible_at', v_trip.no_show_eligible_at,
          'started_at', v_trip.started_at, 'opened_at', v_trip.opened_at),
        'occupied_seats', v_occupied,
        'available_seats', v_trip.capacity - v_occupied,
        'no_show_allowed', v_trip.status = 'BOARDING' and now() >= v_trip.no_show_eligible_at,
        'route', (select jsonb_build_object('id', r.id, 'origin', o.name, 'destination', d.name)
                    from public.routes r
                    join public.stops o on o.id = r.origin_stop_id
                    join public.stops d on d.id = r.destination_stop_id
                   where r.id = v_trip.route_id),
        'bookings', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', b.id, 'code', b.code, 'source', b.source, 'status', b.status,
                   'seat_count', b.seat_count, 'seat_preference', b.seat_preference,
                   'passenger_first_name', split_part(p.full_name, ' ', 1),
                   'walk_in_label', b.walk_in_label, 'total_fare_paise', b.total_fare_paise,
                   'boarded_at', b.boarded_at)
                 order by b.created_at)
            from public.bookings b
            left join public.profiles p on p.id = b.passenger_id
           where b.trip_id = v_trip.id
             and b.status in ('CONFIRMED', 'BOARDED')), '[]'::jsonb));
    end if;
  end if;

  -- Auto (first active assignment)
  select a.id, a.registration_number, a.model, a.colour, a.capacity
    into v_auto
    from public.auto_assignments aa
    join public.autos a on a.id = aa.auto_id and a.status = 'ACTIVE'
   where aa.driver_id = v_driver and aa.revoked_at is null
   order by aa.assigned_at desc
   limit 1;

  -- Today's earnings (start of today in IST)
  v_earnings := public.driver_earnings_summary(
    date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata',
    null,
    null
  );

  return jsonb_build_object(
    'presence', jsonb_build_object(
      'is_online', coalesce(v_presence.is_online, false),
      'lat', v_presence.lat, 'lng', v_presence.lng,
      'location_at', v_presence.location_at, 'last_seen_at', v_presence.last_seen_at),
    'active_trip', v_manifest,
    'auto', case when v_auto.id is not null then jsonb_build_object(
      'id', v_auto.id, 'registration_number', v_auto.registration_number,
      'model', v_auto.model, 'colour', v_auto.colour, 'capacity', v_auto.capacity)
    end,
    'earnings', v_earnings,
    'server_time', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant execute on function
  public.get_my_booking_history(integer, timestamptz),
  public.get_my_booking(uuid),
  public.get_driver_home()
to authenticated;
