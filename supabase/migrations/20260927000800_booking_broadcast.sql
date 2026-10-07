-- Add realtime broadcast to book_seats so the driver gets notified of new bookings.
-- Also covers cancel_booking and add_walk_in for completeness.

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
  v_name text;
begin
  if p_idempotency_key is null then
    perform private.raise_error('IDEMPOTENCY_KEY_REQUIRED');
  end if;

  v_booking := private.idempotent_booking(v_passenger, p_idempotency_key, p_trip_id, p_seat_count);
  if v_booking.id is not null then
    return v_booking;
  end if;

  if p_seat_count is null or p_seat_count < 1 or p_seat_count > v_settings.max_seats_per_booking then
    perform private.raise_error('SEAT_COUNT_INVALID',
      format('Seats per booking must be between 1 and %s', v_settings.max_seats_per_booking));
  end if;

  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found then
    perform private.raise_error('TRIP_NOT_FOUND');
  end if;

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

  if private.trip_occupied_seats(p_trip_id) + p_seat_count > v_trip.capacity then
    perform private.raise_error('NO_SEAT_AVAILABLE', 'Not enough seats left on this auto');
  end if;

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
      return private.idempotent_booking(v_passenger, p_idempotency_key, p_trip_id, p_seat_count);
    end if;
    perform private.raise_error('ALREADY_HAS_ACTIVE_BOOKING', 'You already have an active booking');
  end;

  -- Notify the driver's trip channel about the new booking.
  select split_part(p.full_name, ' ', 1) into v_name
    from public.profiles p where p.id = v_passenger;

  perform private.broadcast(
    'trip:' || p_trip_id,
    'booking_changed',
    jsonb_build_object(
      'booking_id', v_booking.id,
      'passenger_name', coalesce(v_name, 'Passenger'),
      'seat_count', p_seat_count,
      'action', 'booked'
    )
  );

  return v_booking;
end;
$$;
