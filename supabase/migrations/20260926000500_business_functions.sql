-- SawariBuddy: business RPCs. These are the ONLY way clients change operational state.
--
-- Lock order (to avoid deadlocks): trips row -> bookings rows -> driver_presence row.
-- Every function that changes seat occupancy first takes `select ... for update` on the trip row,
-- which serialises all seat decisions for that trip while other trips proceed in parallel.
-- All timing uses the database clock (now()).

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

-- Realtime broadcast to a private channel. realtime.send never raises (it logs a warning on failure),
-- and messages are only delivered if the surrounding transaction commits.
create function private.broadcast(p_topic text, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(p_payload, p_event, p_topic, true);
end;
$$;

-- Any driver RPC call proves the phone is reachable.
create function private.touch_driver(p_driver_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.driver_presence set last_seen_at = now(), updated_at = now() where driver_id = p_driver_id;
$$;

-- Lock a trip that the calling driver owns.
create function private.lock_driver_trip(p_trip_id uuid, p_driver_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.trips;
begin
  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found or v_trip.driver_id <> p_driver_id then
    perform private.raise_error('TRIP_NOT_FOUND', 'Trip not found for this driver');
  end if;
  return v_trip;
end;
$$;

-- Lock the trip that a booking belongs to (trip first, per lock order), return the trip.
create function private.lock_trip_of_booking(p_booking_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.trips;
begin
  select t.* into v_trip
    from public.trips t
   where t.id = (select b.trip_id from public.bookings b where b.id = p_booking_id)
     for update;
  if not found then
    perform private.raise_error('BOOKING_NOT_FOUND', 'Booking not found');
  end if;
  return v_trip;
end;
$$;

-- Cancel a trip and every seat-occupying booking on it. Caller must hold the trip lock.
create function private.cancel_trip_locked(p_trip_id uuid, p_reason public.trip_cancel_reason, p_actor uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.trips;
begin
  update public.bookings
     set status = 'CANCELLED',
         cancelled_at = now(),
         cancelled_by = p_actor,
         cancel_reason = case when p_reason = 'DRIVER_UNREACHABLE' then 'DRIVER_UNREACHABLE'::public.booking_cancel_reason
                              else 'TRIP_CANCELLED'::public.booking_cancel_reason end
   where trip_id = p_trip_id and status in ('CONFIRMED', 'BOARDED');

  update public.trips
     set status = 'CANCELLED', cancelled_at = now(), cancel_reason = p_reason,
         suspended_at = null, suspended_from_status = null
   where id = p_trip_id
  returning * into v_trip;

  update public.driver_presence set active_trip_id = null, updated_at = now() where active_trip_id = p_trip_id;
  return v_trip;
end;
$$;

-- Return an existing booking for an idempotency key, verifying the retry matches the original request.
create function private.idempotent_booking(p_created_by uuid, p_key uuid, p_trip_id uuid, p_seat_count smallint)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings;
begin
  select * into v_b from public.bookings where created_by = p_created_by and idempotency_key = p_key;
  if found and (v_b.trip_id <> p_trip_id or v_b.seat_count <> p_seat_count) then
    perform private.raise_error('IDEMPOTENCY_KEY_REUSED', 'This idempotency key was used for a different request');
  end if;
  return v_b;  -- null row if not found
end;
$$;

-- ---------------------------------------------------------------------------
-- Driver: trip lifecycle
-- ---------------------------------------------------------------------------

-- Go Online: open a trip for an assigned auto on a route.
create function public.open_trip(p_auto_id uuid, p_route_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := private.require_active_driver();
  v_auto public.autos;
  v_route public.routes;
  v_trip public.trips;
  v_constraint text;
begin
  insert into public.driver_presence (driver_id) values (v_driver) on conflict (driver_id) do nothing;

  if exists (select 1 from public.trips where driver_id = v_driver
               and status in ('OPEN', 'BOARDING', 'IN_PROGRESS', 'SUSPENDED')) then
    perform private.raise_error('ACTIVE_TRIP_EXISTS', 'Finish or cancel the current trip first');
  end if;

  select * into v_auto from public.autos where id = p_auto_id;
  if not found or v_auto.status <> 'ACTIVE' then
    perform private.raise_error('AUTO_NOT_AVAILABLE', 'Auto is not active');
  end if;
  if not exists (select 1 from public.auto_assignments
                  where auto_id = p_auto_id and driver_id = v_driver and revoked_at is null) then
    perform private.raise_error('AUTO_NOT_ASSIGNED', 'This auto is not assigned to you');
  end if;

  select r.* into v_route
    from public.routes r
    join public.stops o on o.id = r.origin_stop_id and o.is_active
    join public.stops d on d.id = r.destination_stop_id and d.is_active
   where r.id = p_route_id and r.is_active;
  if not found then
    perform private.raise_error('ROUTE_NOT_AVAILABLE', 'Route is not active');
  end if;

  begin
    insert into public.trips (route_id, auto_id, driver_id, capacity, fare_paise)
    values (p_route_id, p_auto_id, v_driver, v_auto.capacity, v_route.fare_paise)
    returning * into v_trip;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'trips_one_active_per_auto' then
      perform private.raise_error('AUTO_IN_USE', 'This auto is already on an active trip');
    end if;
    perform private.raise_error('ACTIVE_TRIP_EXISTS', 'Finish or cancel the current trip first');
  end;

  update public.driver_presence
     set is_online = true, active_trip_id = v_trip.id, last_seen_at = now(), updated_at = now()
   where driver_id = v_driver;
  return v_trip;
end;
$$;

-- Final call: stop app bookings and start the no-show grace timer.
create function public.final_call(p_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := private.require_active_driver();
  v_trip public.trips := private.lock_driver_trip(p_trip_id, v_driver);
begin
  if v_trip.status <> 'OPEN' then
    perform private.raise_error('INVALID_TRANSITION', format('Final call is not possible from %s', v_trip.status));
  end if;
  update public.trips
     set status = 'BOARDING',
         final_call_at = now(),
         no_show_eligible_at = now() + make_interval(secs => (private.settings()).no_show_grace_seconds)
   where id = p_trip_id
  returning * into v_trip;
  perform private.touch_driver(v_driver);
  return v_trip;
end;
$$;

-- Start: only when nobody who booked is still expected (all boarded, no-show or cancelled).
create function public.start_trip(p_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := private.require_active_driver();
  v_trip public.trips := private.lock_driver_trip(p_trip_id, v_driver);
begin
  if v_trip.status not in ('OPEN', 'BOARDING') then
    perform private.raise_error('INVALID_TRANSITION', format('Cannot start a trip in %s', v_trip.status));
  end if;
  if exists (select 1 from public.bookings where trip_id = p_trip_id and status = 'CONFIRMED') then
    perform private.raise_error('PASSENGERS_PENDING', 'Board or mark no-show for every booked passenger first');
  end if;
  if not exists (select 1 from public.bookings where trip_id = p_trip_id and status = 'BOARDED') then
    perform private.raise_error('NO_PASSENGERS_BOARDED', 'At least one passenger must be on board');
  end if;
  update public.trips set status = 'IN_PROGRESS', started_at = now() where id = p_trip_id returning * into v_trip;
  perform private.touch_driver(v_driver);
  return v_trip;
end;
$$;

-- Complete: boarded passengers -> COMPLETED, fares posted to the ledger. Idempotent.
create function public.complete_trip(p_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := private.is_admin();
  v_trip public.trips;
  v_booking_id uuid;
begin
  if v_is_admin then
    select * into v_trip from public.trips where id = p_trip_id for update;
    if not found then perform private.raise_error('TRIP_NOT_FOUND'); end if;
  else
    v_trip := private.lock_driver_trip(p_trip_id, private.require_active_driver());
  end if;

  if v_trip.status = 'COMPLETED' then
    return v_trip;  -- retry of a completed request
  end if;
  if v_trip.status <> 'IN_PROGRESS' then
    perform private.raise_error('INVALID_TRANSITION', format('Cannot complete a trip in %s', v_trip.status));
  end if;

  for v_booking_id in
    update public.bookings set status = 'COMPLETED', completed_at = now()
     where trip_id = p_trip_id and status = 'BOARDED'
    returning id
  loop
    perform private.ledger_post_booking_fare(v_booking_id);
  end loop;

  update public.trips set status = 'COMPLETED', completed_at = now() where id = p_trip_id returning * into v_trip;
  update public.driver_presence set active_trip_id = null, updated_at = now() where active_trip_id = p_trip_id;
  if not v_is_admin then
    perform private.touch_driver(v_uid);
  end if;
  return v_trip;
end;
$$;

-- Cancel before departure (or a suspended trip). Drivers cannot cancel IN_PROGRESS trips.
create function public.cancel_trip(p_trip_id uuid, p_reason public.trip_cancel_reason default null)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := private.is_admin();
  v_trip public.trips;
  v_reason public.trip_cancel_reason;
begin
  if v_is_admin then
    select * into v_trip from public.trips where id = p_trip_id for update;
    if not found then perform private.raise_error('TRIP_NOT_FOUND'); end if;
    v_reason := coalesce(p_reason, 'ADMIN_CANCELLED');
    if v_reason not in ('ADMIN_CANCELLED', 'DRIVER_UNREACHABLE') then
      perform private.raise_error('INVALID_REASON', 'Admins cancel with ADMIN_CANCELLED or DRIVER_UNREACHABLE');
    end if;
  else
    v_trip := private.lock_driver_trip(p_trip_id, private.require_active_driver());
    v_reason := 'DRIVER_CANCELLED';
  end if;

  if v_trip.status = 'CANCELLED' then
    return v_trip;
  end if;
  if v_trip.status not in ('OPEN', 'BOARDING', 'SUSPENDED') then
    perform private.raise_error('INVALID_TRANSITION', format('Cannot cancel a trip in %s', v_trip.status));
  end if;

  v_trip := private.cancel_trip_locked(p_trip_id, v_reason, v_uid);
  if not v_is_admin then
    perform private.touch_driver(v_uid);
  end if;
  return v_trip;
end;
$$;

-- Driver is back after being unreachable: resume a suspended trip where it left off.
create function public.resume_trip(p_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := private.require_active_driver();
  v_trip public.trips := private.lock_driver_trip(p_trip_id, v_driver);
begin
  if v_trip.status <> 'SUSPENDED' then
    perform private.raise_error('INVALID_TRANSITION', 'Trip is not suspended');
  end if;
  update public.trips
     set status = suspended_from_status, suspended_at = null, suspended_from_status = null
   where id = p_trip_id
  returning * into v_trip;

  update public.issues
     set status = 'RESOLVED', resolved_at = now(), resolution_note = 'Driver reconnected and resumed the trip'
   where trip_id = p_trip_id and source = 'SYSTEM' and kind = 'DRIVER_UNREACHABLE' and status in ('OPEN', 'IN_REVIEW');

  update public.driver_presence set is_online = true, last_seen_at = now(), updated_at = now() where driver_id = v_driver;
  return v_trip;
end;
$$;

-- Go Offline. An empty pre-departure trip is cancelled automatically; otherwise the driver must finish it.
create function public.go_offline()
returns public.driver_presence
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := private.require_role('DRIVER');
  v_trip public.trips;
  v_presence public.driver_presence;
begin
  select t.* into v_trip
    from public.trips t
   where t.driver_id = v_driver and t.status in ('OPEN', 'BOARDING', 'IN_PROGRESS', 'SUSPENDED')
     for update;
  if found then
    if v_trip.status in ('OPEN', 'BOARDING') and private.trip_occupied_seats(v_trip.id) = 0 then
      perform private.cancel_trip_locked(v_trip.id, 'DRIVER_OFFLINE', v_driver);
    else
      perform private.raise_error('ACTIVE_TRIP_EXISTS', 'Complete or cancel the current trip before going offline');
    end if;
  end if;

  update public.driver_presence
     set is_online = false, active_trip_id = null, lat = null, lng = null, accuracy_m = null, location_at = null,
         last_seen_at = now(), updated_at = now()
   where driver_id = v_driver
  returning * into v_presence;
  return v_presence;
end;
$$;

-- Heartbeat + latest location. Call every location_update_interval_seconds while online or on a trip.
-- Location is optional: without a GPS fix the heartbeat still proves the phone is reachable.
create function public.driver_heartbeat(p_lat double precision default null,
                                        p_lng double precision default null,
                                        p_accuracy_m real default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := private.require_role('DRIVER');
  v_settings public.platform_settings := private.settings();
  v_presence public.driver_presence;
  v_has_location boolean := p_lat is not null;
begin
  if (p_lat is null) <> (p_lng is null)
     or p_lat not between -90 and 90 or p_lng not between -180 and 180
     or p_accuracy_m < 0 then
    perform private.raise_error('INVALID_LOCATION', 'Latitude/longitude out of range or incomplete');
  end if;

  select * into v_presence from public.driver_presence where driver_id = v_driver for update;
  if not found or (not v_presence.is_online and v_presence.active_trip_id is null) then
    perform private.raise_error('DRIVER_NOT_ONLINE', 'Go online before sharing location');
  end if;

  -- Server-side throttle against a misbehaving client.
  if v_presence.last_seen_at > now() - make_interval(secs => v_settings.min_location_update_interval_seconds) then
    return jsonb_build_object('accepted', false, 'reason', 'THROTTLED', 'server_time', now(),
                              'next_heartbeat_seconds', v_settings.location_update_interval_seconds);
  end if;

  update public.driver_presence
     set last_seen_at = now(),
         lat = case when v_has_location then p_lat else lat end,
         lng = case when v_has_location then p_lng else lng end,
         accuracy_m = case when v_has_location then p_accuracy_m else accuracy_m end,
         location_at = case when v_has_location then now() else location_at end,
         updated_at = now()
   where driver_id = v_driver
  returning * into v_presence;

  if v_has_location and v_presence.active_trip_id is not null then
    perform private.broadcast('trip:' || v_presence.active_trip_id, 'location',
      jsonb_build_object('trip_id', v_presence.active_trip_id, 'lat', v_presence.lat, 'lng', v_presence.lng,
                         'accuracy_m', v_presence.accuracy_m, 'location_at', v_presence.location_at));
  end if;

  return jsonb_build_object('accepted', true, 'server_time', now(),
                            'next_heartbeat_seconds', v_settings.location_update_interval_seconds);
end;
$$;

-- ---------------------------------------------------------------------------
-- Bookings (passenger) — the concurrency-critical path
-- ---------------------------------------------------------------------------

create function public.book_seats(p_trip_id uuid,
                                  p_seat_count smallint,
                                  p_idempotency_key uuid,
                                  p_seat_preference public.seat_preference default 'ANY')
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_passenger uuid := private.require_role('PASSENGER');
  v_settings public.platform_settings := private.settings();
  v_trip public.trips;
  v_booking public.bookings;
  v_total bigint;
  v_constraint text;
begin
  if p_idempotency_key is null then
    perform private.raise_error('IDEMPOTENCY_KEY_REQUIRED');
  end if;

  -- 1. Fast path: a retry of a request that already succeeded returns the same booking.
  v_booking := private.idempotent_booking(v_passenger, p_idempotency_key, p_trip_id, p_seat_count);
  if v_booking.id is not null then
    return v_booking;
  end if;

  if p_seat_count is null or p_seat_count < 1 or p_seat_count > v_settings.max_seats_per_booking then
    perform private.raise_error('SEAT_COUNT_INVALID',
      format('Seats per booking must be between 1 and %s', v_settings.max_seats_per_booking));
  end if;

  -- 2. Lock the trip row. Every seat-changing operation on this trip queues here.
  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found then
    perform private.raise_error('TRIP_NOT_FOUND');
  end if;

  -- 3. Re-check idempotency under the lock: a concurrent duplicate may have just committed.
  v_booking := private.idempotent_booking(v_passenger, p_idempotency_key, p_trip_id, p_seat_count);
  if v_booking.id is not null then
    return v_booking;
  end if;

  if v_trip.status <> 'OPEN' then
    perform private.raise_error('TRIP_NOT_BOOKABLE', format('Trip is %s', v_trip.status));
  end if;
  if not private.driver_is_reachable(v_trip.driver_id) then
    perform private.raise_error('DRIVER_UNREACHABLE', 'The driver is currently unreachable');
  end if;
  if exists (select 1 from public.bookings where passenger_id = v_passenger and status in ('CONFIRMED', 'BOARDED')) then
    perform private.raise_error('ALREADY_HAS_ACTIVE_BOOKING', 'You already have an active booking');
  end if;

  -- 4. Authoritative occupancy, recomputed from rows while holding the lock.
  if private.trip_occupied_seats(p_trip_id) + p_seat_count > v_trip.capacity then
    perform private.raise_error('NO_SEAT_AVAILABLE', 'Not enough seats left on this auto');
  end if;

  -- 5. Create the booking with fare and fee snapshotted.
  v_total := v_trip.fare_paise * p_seat_count;
  begin
    insert into public.bookings (trip_id, source, passenger_id, seat_count, seat_preference, status,
                                 fare_per_seat_paise, total_fare_paise, platform_fee_paise,
                                 idempotency_key, created_by)
    values (p_trip_id, 'APP', v_passenger, p_seat_count, coalesce(p_seat_preference, 'ANY'), 'CONFIRMED',
            v_trip.fare_paise, v_total, private.platform_fee(v_total, v_settings.commission_bps),
            p_idempotency_key, v_passenger)
    returning * into v_booking;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'bookings_idempotency_uniq' then
      -- Same key raced in on another trip's lock; return whatever the first request produced.
      return private.idempotent_booking(v_passenger, p_idempotency_key, p_trip_id, p_seat_count);
    end if;
    -- A concurrent booking by the same passenger on a different trip won.
    perform private.raise_error('ALREADY_HAS_ACTIVE_BOOKING', 'You already have an active booking');
  end;
  return v_booking;
end;
$$;

-- Passenger cancels before boarding. Free in V1. Idempotent.
create function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_passenger uuid := private.require_role('PASSENGER');
  v_trip public.trips := private.lock_trip_of_booking(p_booking_id);
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.passenger_id is distinct from v_passenger then
    perform private.raise_error('BOOKING_NOT_FOUND', 'Booking not found');
  end if;
  if v_booking.status = 'CANCELLED' and v_booking.cancel_reason = 'PASSENGER_CANCELLED' then
    return v_booking;
  end if;
  if v_booking.status <> 'CONFIRMED' then
    perform private.raise_error('INVALID_TRANSITION', format('A %s booking cannot be cancelled', v_booking.status));
  end if;
  update public.bookings
     set status = 'CANCELLED', cancelled_at = now(), cancel_reason = 'PASSENGER_CANCELLED', cancelled_by = v_passenger
   where id = p_booking_id
  returning * into v_booking;
  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Driver: walk-ins, boarding, no-shows
-- ---------------------------------------------------------------------------

-- "+ Add Walk-in Passenger": same trip lock and seat check as book_seats. Idempotent per driver key.
create function public.add_walk_in(p_trip_id uuid,
                                   p_seat_count smallint,
                                   p_idempotency_key uuid,
                                   p_label text default null)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := private.require_active_driver();
  v_settings public.platform_settings := private.settings();
  v_trip public.trips;
  v_booking public.bookings;
  v_total bigint;
begin
  if p_idempotency_key is null then
    perform private.raise_error('IDEMPOTENCY_KEY_REQUIRED');
  end if;

  v_trip := private.lock_driver_trip(p_trip_id, v_driver);

  v_booking := private.idempotent_booking(v_driver, p_idempotency_key, p_trip_id, p_seat_count);
  if v_booking.id is not null then
    return v_booking;
  end if;

  if v_trip.status not in ('OPEN', 'BOARDING') then
    perform private.raise_error('TRIP_NOT_ACCEPTING_WALK_INS', format('Trip is %s', v_trip.status));
  end if;
  if p_seat_count is null or p_seat_count < 1 or p_seat_count > v_trip.capacity then
    perform private.raise_error('SEAT_COUNT_INVALID', format('Walk-in seats must be between 1 and %s', v_trip.capacity));
  end if;
  if private.trip_occupied_seats(p_trip_id) + p_seat_count > v_trip.capacity then
    perform private.raise_error('NO_SEAT_AVAILABLE', 'The auto is full');
  end if;

  v_total := v_trip.fare_paise * p_seat_count;
  insert into public.bookings (trip_id, source, walk_in_label, seat_count, status, boarded_at,
                               fare_per_seat_paise, total_fare_paise, platform_fee_paise,
                               idempotency_key, created_by)
  values (p_trip_id, 'WALK_IN', nullif(btrim(p_label), ''), p_seat_count, 'BOARDED', now(),
          v_trip.fare_paise, v_total, private.platform_fee(v_total, v_settings.walk_in_commission_bps),
          p_idempotency_key, v_driver)
  returning * into v_booking;

  perform private.touch_driver(v_driver);
  return v_booking;
end;
$$;

-- Walk-in got off before departure.
create function public.remove_walk_in(p_booking_id uuid)
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
  if v_booking.source <> 'WALK_IN' then
    perform private.raise_error('NOT_A_WALK_IN', 'Only walk-in passengers can be removed by the driver');
  end if;
  if v_booking.status = 'CANCELLED' then
    return v_booking;
  end if;
  if v_booking.status <> 'BOARDED' or v_trip.status not in ('OPEN', 'BOARDING') then
    perform private.raise_error('INVALID_TRANSITION', 'Walk-ins can only be removed before the trip starts');
  end if;
  update public.bookings
     set status = 'CANCELLED', cancelled_at = now(), cancel_reason = 'WALK_IN_REMOVED', cancelled_by = v_driver
   where id = p_booking_id
  returning * into v_booking;
  perform private.touch_driver(v_driver);
  return v_booking;
end;
$$;

-- Passenger with an app booking got into the auto. Idempotent.
create function public.mark_boarded(p_booking_id uuid)
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
  if v_booking.status <> 'CONFIRMED' or v_trip.status not in ('OPEN', 'BOARDING') then
    perform private.raise_error('INVALID_TRANSITION',
      format('Cannot board a %s booking on a %s trip', v_booking.status, v_trip.status));
  end if;
  update public.bookings set status = 'BOARDED', boarded_at = now() where id = p_booking_id returning * into v_booking;
  perform private.touch_driver(v_driver);
  return v_booking;
end;
$$;

-- Passenger did not arrive. Allowed only after final call + no_show_grace_seconds. Frees the seats.
create function public.mark_no_show(p_booking_id uuid)
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
  if v_booking.status = 'NO_SHOW' then
    return v_booking;
  end if;
  if v_booking.source <> 'APP' or v_booking.status <> 'CONFIRMED' then
    perform private.raise_error('INVALID_TRANSITION', format('A %s %s booking cannot be marked no-show', v_booking.source, v_booking.status));
  end if;
  if v_trip.status <> 'BOARDING' then
    perform private.raise_error('FINAL_CALL_REQUIRED', 'Make the final call before marking a no-show');
  end if;
  if now() < v_trip.no_show_eligible_at then
    perform private.raise_error('GRACE_PERIOD_NOT_ELAPSED',
      format('No-show allowed in %s seconds', ceil(extract(epoch from v_trip.no_show_eligible_at - now()))::integer));
  end if;
  update public.bookings
     set status = 'NO_SHOW', no_show_at = now(), no_show_marked_by = v_driver
   where id = p_booking_id
  returning * into v_booking;
  perform private.touch_driver(v_driver);
  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Issues
-- ---------------------------------------------------------------------------
create function public.raise_issue(p_kind public.issue_kind,
                                   p_description text,
                                   p_booking_id uuid default null,
                                   p_trip_id uuid default null)
returns public.issues
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role := private.auth_user_role();
  v_trip_id uuid := p_trip_id;
  v_driver_id uuid;
  v_issue public.issues;
begin
  if v_role is null or v_role = 'ADMIN' then
    perform private.raise_error('NOT_AUTHORISED');
  end if;
  if p_kind in ('DRIVER_UNREACHABLE', 'TRIP_STUCK') then
    perform private.raise_error('INVALID_ISSUE_KIND', 'This kind is raised by the system');
  end if;

  if p_booking_id is not null then
    select b.trip_id into v_trip_id from public.bookings b
      join public.trips t on t.id = b.trip_id
     where b.id = p_booking_id
       and ((v_role = 'PASSENGER' and b.passenger_id = v_uid) or (v_role = 'DRIVER' and t.driver_id = v_uid));
    if not found then perform private.raise_error('BOOKING_NOT_FOUND'); end if;
  end if;

  if v_trip_id is not null then
    select t.driver_id into v_driver_id from public.trips t
     where t.id = v_trip_id
       and ((v_role = 'DRIVER' and t.driver_id = v_uid)
         or (v_role = 'PASSENGER' and exists (select 1 from public.bookings b where b.trip_id = t.id and b.passenger_id = v_uid)));
    if not found then perform private.raise_error('TRIP_NOT_FOUND'); end if;
  end if;

  insert into public.issues (source, kind, raised_by, booking_id, trip_id, driver_id, description)
  values (v_role::text::public.issue_source, p_kind, v_uid, p_booking_id, v_trip_id, v_driver_id, btrim(p_description))
  returning * into v_issue;
  return v_issue;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled: driver unreachable beyond driver_intervention_seconds (runs every minute via pg_cron)
-- ---------------------------------------------------------------------------
create function private.sweep_unreachable_drivers()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz := now() - make_interval(secs => (private.settings()).driver_intervention_seconds);
  v_trip public.trips;
  v_suspended integer := 0;
  v_cancelled integer := 0;
  v_in_progress_flagged integer := 0;
  v_drivers_offlined integer := 0;
begin
  -- Pre-departure trips. SKIP LOCKED: never block a driver's in-flight request.
  for v_trip in
    select t.* from public.trips t
      join public.driver_presence dp on dp.driver_id = t.driver_id
     where t.status in ('OPEN', 'BOARDING')
       and (dp.last_seen_at is null or dp.last_seen_at < v_cutoff)
     for update of t skip locked
  loop
    if private.trip_occupied_seats(v_trip.id) > 0 then
      update public.trips
         set status = 'SUSPENDED', suspended_at = now(), suspended_from_status = v_trip.status
       where id = v_trip.id;
      insert into public.issues (source, kind, trip_id, driver_id, description)
      values ('SYSTEM', 'DRIVER_UNREACHABLE', v_trip.id, v_trip.driver_id,
              'Driver unreachable before departure; trip suspended. Passengers may cancel. Resume (driver) or cancel (admin).')
      on conflict (trip_id, kind) where source = 'SYSTEM' and status in ('OPEN', 'IN_REVIEW') do nothing;
      v_suspended := v_suspended + 1;
    else
      perform private.cancel_trip_locked(v_trip.id, 'DRIVER_UNREACHABLE', null);
      update public.driver_presence
         set is_online = false, lat = null, lng = null, accuracy_m = null, location_at = null, updated_at = now()
       where driver_id = v_trip.driver_id;
      v_cancelled := v_cancelled + 1;
    end if;
  end loop;

  -- In-progress trips are never suspended (passengers are on board); flag for admin once.
  with flagged as (
    insert into public.issues (source, kind, trip_id, driver_id, description)
    select 'SYSTEM', 'DRIVER_UNREACHABLE', t.id, t.driver_id,
           'Driver unreachable during an in-progress trip.'
      from public.trips t
      join public.driver_presence dp on dp.driver_id = t.driver_id
     where t.status = 'IN_PROGRESS' and (dp.last_seen_at is null or dp.last_seen_at < v_cutoff)
    on conflict (trip_id, kind) where source = 'SYSTEM' and status in ('OPEN', 'IN_REVIEW') do nothing
    returning 1
  )
  select count(*) into v_in_progress_flagged from flagged;

  -- Online drivers without a trip who vanished: mark offline and stop exposing a stale location.
  with offlined as (
    update public.driver_presence
       set is_online = false, lat = null, lng = null, accuracy_m = null, location_at = null, updated_at = now()
     where is_online and active_trip_id is null and (last_seen_at is null or last_seen_at < v_cutoff)
    returning 1
  )
  select count(*) into v_drivers_offlined from offlined;

  return jsonb_build_object('suspended', v_suspended, 'cancelled_empty', v_cancelled,
                            'in_progress_flagged', v_in_progress_flagged, 'drivers_offlined', v_drivers_offlined);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin helpers needed from Phase 1 (full admin tooling comes with the admin app)
-- ---------------------------------------------------------------------------
create function public.admin_set_user_role(p_user_id uuid, p_role public.user_role)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if not private.is_admin() then
    perform private.raise_error('NOT_AUTHORISED');
  end if;
  if p_user_id = auth.uid() then
    perform private.raise_error('CANNOT_CHANGE_OWN_ROLE');
  end if;
  update public.profiles set role = p_role where id = p_user_id returning * into v_profile;
  if not found then perform private.raise_error('USER_NOT_FOUND'); end if;
  return v_profile;
end;
$$;
