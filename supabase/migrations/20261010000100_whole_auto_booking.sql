-- Booking 1 to 4 seats, or the whole auto.
--
-- A whole-auto booking is a booking for all of the trip's seats (seat_count = trip capacity). It may
-- exceed max_seats_per_booking, and the existing capacity check under the trip lock means it only
-- succeeds while the auto is empty; afterwards no other booking or walk-in fits. Fare and platform
-- fee are computed as for any booking: seats x per-seat fare.
--
-- max_seats_per_booking is raised to 4 where it is lower (product decision: 1, 2, 3, 4 or whole auto).

update public.platform_settings set max_seats_per_booking = 4 where max_seats_per_booking < 4;

create or replace function public.book_seats(p_trip_id uuid,
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

  if p_seat_count is null or p_seat_count < 1 then
    perform private.raise_error('SEAT_COUNT_INVALID', 'Book at least one seat');
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

  -- Up to max_seats_per_booking, or the whole auto (every seat; the capacity check below then
  -- requires it to be empty).
  if p_seat_count > v_settings.max_seats_per_booking and p_seat_count <> v_trip.capacity then
    perform private.raise_error('SEAT_COUNT_INVALID',
      format('Book up to %s seats, or the whole auto (%s seats)', v_settings.max_seats_per_booking, v_trip.capacity));
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
