-- Drop off each passenger on their own, with the cash recorded at the same time.
--
-- Until now the driver ended the whole trip at once and then marked each passenger's cash on the
-- Collect payment screen. Passengers get off at different times, so now:
--   * drop_off_passenger(booking, received) moves one BOARDED booking on an IN_PROGRESS trip to
--     COMPLETED with payment PAID (fare posted) or UNPAID (nothing posted). Idempotent; on an
--     already dropped-off booking it behaves like mark_booking_payment (Not paid -> Received works).
--   * complete_trip ("End trip") refuses a driver while anyone is still on board
--     (PASSENGERS_ON_BOARD). Admins can still force-complete: remaining passengers become COMPLETED
--     with payment PENDING, as before, and the driver marks them on the Collect payment screen.
--   * get_driver_home lists dropped-off passengers on the active trip with their payment status.
--   * booking_changed broadcasts carry payment_status, so the passenger's "you've arrived" notice
--     knows whether the fare was recorded as paid.

-- A booking can be completed straight to PAID / UNPAID (drop-off), not only to PENDING.
create or replace function private.bookings_payment_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_status is distinct from old.payment_status and not (
       (old.payment_status is null)
    or (old.payment_status = 'PENDING' and new.payment_status in ('PAID', 'UNPAID'))
    or (old.payment_status = 'UNPAID' and new.payment_status = 'PAID')
  ) then
    perform private.raise_error('INVALID_TRANSITION',
      format('Payment cannot move from %s to %s', coalesce(old.payment_status::text, 'none'), new.payment_status));
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Driver: drop off one passenger and record whether they paid.
-- ---------------------------------------------------------------------------
create function public.drop_off_passenger(p_booking_id uuid, p_received boolean)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_trip public.trips := private.lock_trip_of_booking(p_booking_id);
  v_booking public.bookings;
begin
  if p_received is null then
    perform private.raise_error('INVALID_TRANSITION', 'Say whether the payment was received');
  end if;
  if private.require_active_driver() <> v_trip.driver_id then
    perform private.raise_error('BOOKING_NOT_FOUND');
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.status = 'COMPLETED' then
    -- Retry, or a change of answer (Not paid -> Received); mark_booking_payment handles both.
    return public.mark_booking_payment(p_booking_id, p_received);
  end if;
  if v_booking.status <> 'BOARDED' then
    perform private.raise_error('INVALID_TRANSITION', format('Only passengers on board can be dropped off; this booking is %s', v_booking.status));
  end if;
  if v_trip.status <> 'IN_PROGRESS' then
    perform private.raise_error('INVALID_TRANSITION', format('Start the trip before dropping off passengers; the trip is %s', v_trip.status));
  end if;

  update public.bookings
     set status = 'COMPLETED', completed_at = now(),
         payment_status = case when p_received then 'PAID'::public.payment_status else 'UNPAID'::public.payment_status end,
         payment_marked_at = now(), payment_marked_by = v_uid
   where id = p_booking_id
  returning * into v_booking;

  if p_received then
    perform private.ledger_post_booking_fare(p_booking_id);
  end if;
  perform private.touch_driver(v_uid);
  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- End trip: drivers first drop off everyone on board. Admins can still force-complete.
-- ---------------------------------------------------------------------------
create or replace function public.complete_trip(p_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := private.is_admin();
  v_trip public.trips;
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
  if not v_is_admin and exists (select 1 from public.bookings where trip_id = p_trip_id and status = 'BOARDED') then
    perform private.raise_error('PASSENGERS_ON_BOARD', 'Drop off every passenger before ending the trip');
  end if;

  -- Only an admin force-complete leaves anyone here; the driver marks their payment afterwards.
  update public.bookings set status = 'COMPLETED', completed_at = now(), payment_status = 'PENDING'
   where trip_id = p_trip_id and status = 'BOARDED';

  update public.trips set status = 'COMPLETED', completed_at = now() where id = p_trip_id returning * into v_trip;
  update public.driver_presence set active_trip_id = null, updated_at = now() where active_trip_id = p_trip_id;
  if not v_is_admin then
    perform private.touch_driver(v_uid);
  end if;
  return v_trip;
end;
$$;

-- ---------------------------------------------------------------------------
-- booking_changed: add payment_status (otherwise unchanged from 20260930000100).
-- ---------------------------------------------------------------------------
create or replace function private.bookings_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.trips;
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    select * into v_trip from public.trips where id = new.trip_id;
    perform private.broadcast('trip:' || new.trip_id, 'booking_changed',
      jsonb_build_object('trip_id', new.trip_id, 'booking_id', new.id, 'source', new.source,
                         'status', new.status, 'seat_count', new.seat_count,
                         'cancel_reason', new.cancel_reason, 'payment_status', new.payment_status,
                         'available_seats', v_trip.capacity - private.trip_occupied_seats(new.trip_id)));
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_driver_home: dropped-off passengers stay on the manifest with their payment status.
-- (Otherwise unchanged from 20260927000200.)
-- ---------------------------------------------------------------------------
create or replace function public.get_driver_home()
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
                   'boarded_at', b.boarded_at, 'completed_at', b.completed_at,
                   'payment_status', b.payment_status)
                 order by b.created_at)
            from public.bookings b
            left join public.profiles p on p.id = b.passenger_id
           where b.trip_id = v_trip.id
             and b.status in ('CONFIRMED', 'BOARDED', 'COMPLETED')), '[]'::jsonb));
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

revoke execute on function public.drop_off_passenger(uuid, boolean) from public, anon;
grant execute on function public.drop_off_passenger(uuid, boolean) to authenticated;
