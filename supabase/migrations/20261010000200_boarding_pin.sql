-- Boarding PIN (like Uber / Rapido): the driver boards an app passenger by entering the 4-digit PIN
-- shown in the passenger's app.
--
-- * Every APP booking gets a random 4-digit PIN at creation, unique among the PINs on its trip. PINs
--   cannot be unique across all trips (10,000 values) and need not be: the driver only matches
--   against passengers on their own trip.
-- * PINs live in booking_pins, readable only by the booking's passenger. Drivers can read bookings
--   on their trips but never the PIN; board_with_pin checks it server-side.
-- * board_with_pin(trip, pin) finds the passenger the PIN belongs to and boards them. After 5 wrong
--   PINs within a minute it refuses until the minute has passed. A wrong PIN is returned as a result
--   (not raised), so the failed attempt is recorded.
-- * mark_boarded no longer boards APP bookings (PIN_REQUIRED). There is no "board without PIN".

create table public.booking_pins (
  booking_id  uuid primary key references public.bookings (id) on delete cascade,
  trip_id     uuid not null references public.trips (id),
  pin         text not null check (pin ~ '^[0-9]{4}$'),
  created_at  timestamptz not null default now(),
  constraint booking_pins_unique_per_trip unique (trip_id, pin)
);

alter table public.booking_pins enable row level security;
grant select on public.booking_pins to authenticated;
create policy booking_pins_select_own on public.booking_pins for select to authenticated
  using (private.owns_booking(booking_id));

-- Wrong-PIN throttle. Private: no client access.
create table private.pin_attempts (
  id            bigint generated always as identity primary key,
  trip_id       uuid not null,
  driver_id     uuid not null,
  succeeded     boolean not null,
  attempted_at  timestamptz not null default now()
);
create index pin_attempts_recent_idx on private.pin_attempts (trip_id, driver_id, attempted_at desc);

-- A random 4-digit PIN not yet used on the trip (cryptographic randomness from pgcrypto).
create function private.assign_booking_pin(p_booking_id uuid, p_trip_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin text;
  v_bytes bytea;
begin
  for i in 1..50 loop
    v_bytes := extensions.gen_random_bytes(2);
    v_pin := lpad(((get_byte(v_bytes, 0) * 256 + get_byte(v_bytes, 1)) % 10000)::text, 4, '0');
    insert into public.booking_pins (booking_id, trip_id, pin) values (p_booking_id, p_trip_id, v_pin)
    on conflict do nothing;
    if found then
      return v_pin;
    end if;
  end loop;
  perform private.raise_error('INVALID_TRANSITION', 'Could not assign a boarding PIN');
end;
$$;

create function private.bookings_assign_pin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source = 'APP' then
    perform private.assign_booking_pin(new.id, new.trip_id);
  end if;
  return null;
end;
$$;

create trigger bookings_assign_pin after insert on public.bookings
  for each row execute function private.bookings_assign_pin();

-- Passengers waiting to board when this ships need a PIN too.
select private.assign_booking_pin(b.id, b.trip_id)
  from public.bookings b
 where b.source = 'APP' and b.status = 'CONFIRMED'
   and not exists (select 1 from public.booking_pins bp where bp.booking_id = b.id);

-- ---------------------------------------------------------------------------
-- Driver: board the passenger whose PIN this is.
-- Returns {ok: true, booking_id, passenger_first_name, seat_count, already_boarded}
--      or {ok: false, reason: 'MISMATCH', attempts_left} / {ok: false, reason: 'LOCKED', retry_after_seconds}
-- ---------------------------------------------------------------------------
create function public.board_with_pin(p_trip_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := private.require_active_driver();
  v_max_failures constant integer := 5;
  v_window constant interval := interval '1 minute';
  v_trip public.trips;
  v_failures integer;
  v_oldest timestamptz;
  v_booking public.bookings;
  v_name text;
begin
  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found or v_trip.driver_id <> v_driver then
    perform private.raise_error('TRIP_NOT_FOUND');
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    perform private.raise_error('PIN_INVALID', 'Enter the 4-digit PIN');
  end if;

  select count(*), min(attempted_at) into v_failures, v_oldest
    from (select attempted_at from private.pin_attempts
           where trip_id = p_trip_id and driver_id = v_driver and not succeeded
             and attempted_at > now() - v_window
           order by attempted_at desc limit v_max_failures) recent;
  if v_failures >= v_max_failures then
    return jsonb_build_object('ok', false, 'reason', 'LOCKED',
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_oldest + v_window - now()))))::integer);
  end if;

  select b.* into v_booking
    from public.bookings b
    join public.booking_pins bp on bp.booking_id = b.id
   where b.trip_id = p_trip_id and bp.pin = p_pin
   for update of b;
  if not found or v_booking.status not in ('CONFIRMED', 'BOARDED') then
    insert into private.pin_attempts (trip_id, driver_id, succeeded) values (p_trip_id, v_driver, false);
    return jsonb_build_object('ok', false, 'reason', 'MISMATCH', 'attempts_left', v_max_failures - v_failures - 1);
  end if;

  insert into private.pin_attempts (trip_id, driver_id, succeeded) values (p_trip_id, v_driver, true);
  select split_part(p.full_name, ' ', 1) into v_name from public.profiles p where p.id = v_booking.passenger_id;

  if v_booking.status = 'CONFIRMED' then
    if v_trip.status not in ('OPEN', 'BOARDING') then
      perform private.raise_error('INVALID_TRANSITION', format('Cannot board on a %s trip', v_trip.status));
    end if;
    update public.bookings set status = 'BOARDED', boarded_at = now() where id = v_booking.id;
  end if;
  perform private.touch_driver(v_driver);

  return jsonb_build_object('ok', true, 'booking_id', v_booking.id, 'passenger_first_name', v_name,
                            'seat_count', v_booking.seat_count, 'already_boarded', v_booking.status = 'BOARDED');
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_boarded: walk-ins only now (app passengers need the PIN). Otherwise unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.mark_boarded(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := private.require_active_driver();
  v_trip public.trips := private.lock_trip_of_booking(p_booking_id);
  v_booking public.bookings;
begin
  if v_trip.driver_id <> v_driver then
    perform private.raise_error('BOOKING_NOT_FOUND', 'Booking not found');
  end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.status = 'BOARDED' then
    return v_booking;
  end if;
  -- App passengers board only with their PIN (board_with_pin). Walk-ins are created BOARDED.
  if v_booking.source = 'APP' then
    perform private.raise_error('PIN_REQUIRED', 'Enter the passenger''s boarding PIN');
  end if;
  if v_booking.status <> 'CONFIRMED' or v_trip.status not in ('OPEN', 'BOARDING') then
    perform private.raise_error('INVALID_TRANSITION',
      format('Cannot board a %s booking on a %s trip', v_booking.status, v_trip.status));
  end if;
  update public.bookings set status = 'BOARDED', boarded_at = now() where id = p_booking_id returning * into v_booking;
  perform private.touch_driver(v_driver);
  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Passenger reads: include the boarding PIN (otherwise unchanged)
-- ---------------------------------------------------------------------------
create or replace function public.get_my_active_booking()
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
             'lat', dp.lat, 'lng', dp.lng, 'location_at', dp.location_at),
           'boarding_pin', bp.pin)
    from public.bookings b
    join public.trips t on t.id = b.trip_id
    join public.routes r on r.id = t.route_id
    join public.stops o on o.id = r.origin_stop_id
    join public.stops d on d.id = r.destination_stop_id
    join public.autos a on a.id = t.auto_id
    join public.profiles p on p.id = t.driver_id
    left join public.driver_presence dp on dp.driver_id = t.driver_id
    left join public.booking_pins bp on bp.booking_id = b.id
   where b.passenger_id = (select auth.uid())
     and b.status in ('CONFIRMED', 'BOARDED');
$$;

create or replace function public.get_my_booking(p_booking_id uuid)
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
               'cancel_reason', b.cancel_reason, 'no_show_at', b.no_show_at,
               'payment_status', b.payment_status, 'payment_marked_at', b.payment_marked_at),
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
               'lat', dp.lat, 'lng', dp.lng, 'location_at', dp.location_at),
             'rating', case when rr.booking_id is not null then jsonb_build_object(
               'stars', rr.stars, 'comment', rr.comment, 'created_at', rr.created_at) end,
             'boarding_pin', bp.pin)
      from public.bookings b
      join public.trips t on t.id = b.trip_id
      join public.routes r on r.id = t.route_id
      join public.stops o on o.id = r.origin_stop_id
      join public.stops d on d.id = r.destination_stop_id
      join public.autos a on a.id = t.auto_id
      join public.profiles p on p.id = t.driver_id
      left join public.driver_presence dp on dp.driver_id = t.driver_id
      left join public.ride_ratings rr on rr.booking_id = b.id
      left join public.booking_pins bp on bp.booking_id = b.id
     where b.id = p_booking_id
       and b.passenger_id = v_uid
  );
  -- Returns NULL if the booking doesn't exist or doesn't belong to the caller.
end;
$$;

revoke execute on function public.board_with_pin(uuid, text) from public, anon;
grant execute on function public.board_with_pin(uuid, text) to authenticated;
