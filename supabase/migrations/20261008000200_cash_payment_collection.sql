-- Cash payment collection at drop-off.
--
-- Until now complete_trip assumed every boarded passenger paid cash and posted the fare to the ledger
-- at once. Now a completed booking carries a payment status the driver sets on the Collect payment
-- screen right after ending the trip:
--   PENDING  set by complete_trip; nothing in the ledger yet
--   PAID     driver received the cash: the fare is posted (driver earning + platform fee owed)
--   UNPAID   passenger did not pay: nothing is posted, so the driver is not charged a fee for it
-- PENDING -> PAID | UNPAID, and UNPAID -> PAID (paid late). PAID is final (support corrects it with a
-- ledger adjustment). A driver cannot open a new trip while any of their bookings is PENDING.
-- Bookings completed before this migration were already posted as cash, so they become PAID.

create type public.payment_status as enum ('PENDING', 'PAID', 'UNPAID');

alter table public.bookings
  add column payment_status    public.payment_status,
  add column payment_marked_at timestamptz,
  add column payment_marked_by uuid references public.profiles (id);

update public.bookings
   set payment_status = 'PAID', payment_marked_at = completed_at
 where status = 'COMPLETED';

alter table public.bookings
  add constraint bookings_payment_when_completed check ((status = 'COMPLETED') = (payment_status is not null)),
  add constraint bookings_payment_marked check (payment_status is distinct from 'PENDING' or payment_marked_at is null);

create index bookings_payment_pending_idx on public.bookings (trip_id) where payment_status = 'PENDING';

-- Payment status moves only forward (defence in depth; mark_booking_payment checks too).
create function private.bookings_payment_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_status is distinct from old.payment_status and not (
       (old.payment_status is null and new.payment_status = 'PENDING')
    or (old.payment_status = 'PENDING' and new.payment_status in ('PAID', 'UNPAID'))
    or (old.payment_status = 'UNPAID' and new.payment_status = 'PAID')
  ) then
    perform private.raise_error('INVALID_TRANSITION',
      format('Payment cannot move from %s to %s', coalesce(old.payment_status::text, 'none'), new.payment_status));
  end if;
  return new;
end;
$$;

create trigger bookings_payment_guard before update of payment_status on public.bookings
  for each row execute function private.bookings_payment_guard();

-- No new trip while a passenger from an earlier trip has no payment status.
create function private.trips_require_payments_marked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.bookings b
               join public.trips t on t.id = b.trip_id
              where t.driver_id = new.driver_id and b.payment_status = 'PENDING') then
    perform private.raise_error('PAYMENTS_PENDING', 'Mark payment for passengers of your last trip first');
  end if;
  return new;
end;
$$;

create trigger trips_require_payments_marked before insert on public.trips
  for each row execute function private.trips_require_payments_marked();

-- ---------------------------------------------------------------------------
-- Complete: boarded passengers -> COMPLETED with payment PENDING. Nothing is posted here any more.
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
-- Driver (or admin): record whether a completed booking's cash was received. Idempotent.
-- ---------------------------------------------------------------------------
create function public.mark_booking_payment(p_booking_id uuid, p_received boolean)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := private.is_admin();
  v_trip public.trips := private.lock_trip_of_booking(p_booking_id);
  v_booking public.bookings;
  v_target public.payment_status := case when p_received then 'PAID'::public.payment_status
                                         else 'UNPAID'::public.payment_status end;
begin
  if p_received is null then
    perform private.raise_error('INVALID_TRANSITION', 'Say whether the payment was received');
  end if;
  if not v_is_admin then
    if private.require_role('DRIVER') <> v_trip.driver_id then
      perform private.raise_error('BOOKING_NOT_FOUND');
    end if;
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.status <> 'COMPLETED' then
    perform private.raise_error('INVALID_TRANSITION', format('Payment is recorded for completed rides; this booking is %s', v_booking.status));
  end if;
  if v_booking.payment_status = v_target then
    return v_booking;  -- retry
  end if;
  if v_booking.payment_status = 'PAID' then
    perform private.raise_error('PAYMENT_ALREADY_RECEIVED');
  end if;

  update public.bookings
     set payment_status = v_target, payment_marked_at = now(), payment_marked_by = v_uid
   where id = p_booking_id
  returning * into v_booking;

  if v_target = 'PAID' then
    perform private.ledger_post_booking_fare(p_booking_id);
  end if;
  if not v_is_admin then
    perform private.touch_driver(v_uid);
  end if;
  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Driver: the Collect payment screen. Every PENDING booking, plus the rest of the latest completed
-- trip so the driver sees the whole trip (and can still change Not paid to Received).
-- ---------------------------------------------------------------------------
create function public.get_driver_payments_to_collect()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_driver uuid := private.require_role('DRIVER');
  v_latest uuid;
begin
  select t.id into v_latest from public.trips t
   where t.driver_id = v_driver and t.status = 'COMPLETED'
   order by t.completed_at desc limit 1;

  return jsonb_build_object(
    'pending_count', (select count(*) from public.bookings b join public.trips t on t.id = b.trip_id
                       where t.driver_id = v_driver and b.payment_status = 'PENDING'),
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'code', b.code, 'source', b.source, 'payment_status', b.payment_status,
               'seat_count', b.seat_count, 'total_fare_paise', b.total_fare_paise,
               'passenger_first_name', split_part(p.full_name, ' ', 1), 'walk_in_label', b.walk_in_label,
               'trip_id', t.id, 'origin', o.name, 'destination', d.name, 'completed_at', b.completed_at)
             order by t.completed_at desc, b.created_at)
        from public.bookings b
        join public.trips t on t.id = b.trip_id
        join public.routes r on r.id = t.route_id
        join public.stops o on o.id = r.origin_stop_id
        join public.stops d on d.id = r.destination_stop_id
        left join public.profiles p on p.id = b.passenger_id
       where t.driver_id = v_driver
         and b.status = 'COMPLETED'
         and (b.payment_status = 'PENDING' or t.id = v_latest)), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Reads: payment status on the passenger's bookings; trip history counts only collected fares.
-- (Otherwise unchanged from 20261004000100 and 20261006000200.)
-- ---------------------------------------------------------------------------
create or replace function public.get_my_booking_history(
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
               'auto_registration', a.registration_number,
               'rating_stars', rr.stars,
               'payment_status', b.payment_status
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
        left join public.ride_ratings rr on rr.booking_id = b.id
       where b.passenger_id = v_uid
         and (p_before is null or b.created_at < p_before)
       order by b.created_at desc, b.id desc
       limit v_limit
    ) sub
  ), '[]'::jsonb);
end;
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
               'stars', rr.stars, 'comment', rr.comment, 'created_at', rr.created_at) end)
      from public.bookings b
      join public.trips t on t.id = b.trip_id
      join public.routes r on r.id = t.route_id
      join public.stops o on o.id = r.origin_stop_id
      join public.stops d on d.id = r.destination_stop_id
      join public.autos a on a.id = t.auto_id
      join public.profiles p on p.id = t.driver_id
      left join public.driver_presence dp on dp.driver_id = t.driver_id
      left join public.ride_ratings rr on rr.booking_id = b.id
     where b.id = p_booking_id
       and b.passenger_id = v_uid
  );
  -- Returns NULL if the booking doesn't exist or doesn't belong to the caller.
end;
$$;

create or replace function public.get_driver_trip_history(
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
  v_driver uuid := private.require_role('DRIVER');
  v_limit  integer := least(greatest(p_limit, 1), 50);  -- clamp 1..50
begin
  return coalesce((
    select jsonb_agg(row_obj order by created_at desc)
    from (
      select jsonb_build_object(
               'id', t.id,
               'status', t.status,
               'cancel_reason', t.cancel_reason,
               'created_at', t.created_at,
               'started_at', t.started_at,
               'completed_at', t.completed_at,
               'cancelled_at', t.cancelled_at,
               'origin', o.name,
               'destination', d.name,
               'auto_registration', a.registration_number,
               'passenger_count', coalesce(s.passenger_count, 0),
               'seat_count', coalesce(s.seat_count, 0),
               'fare_paise', coalesce(s.fare_paise, 0),
               'platform_fee_paise', coalesce(s.platform_fee_paise, 0),
               'unpaid_count', coalesce(s.unpaid_count, 0),
               'payment_pending_count', coalesce(s.payment_pending_count, 0)
             ) as row_obj,
             t.created_at
        from public.trips t
        join public.routes r on r.id = t.route_id
        join public.stops o on o.id = r.origin_stop_id
        join public.stops d on d.id = r.destination_stop_id
        join public.autos a on a.id = t.auto_id
        left join lateral (
          select count(*)::integer as passenger_count,
                 sum(b.seat_count)::integer as seat_count,
                 -- money actually collected: fares the driver marked as received
                 sum(b.total_fare_paise) filter (where b.payment_status = 'PAID')::bigint as fare_paise,
                 sum(b.platform_fee_paise) filter (where b.payment_status = 'PAID')::bigint as platform_fee_paise,
                 count(*) filter (where b.payment_status = 'UNPAID')::integer as unpaid_count,
                 count(*) filter (where b.payment_status = 'PENDING')::integer as payment_pending_count
            from public.bookings b
           where b.trip_id = t.id and b.status = 'COMPLETED'
        ) s on true
       where t.driver_id = v_driver
         and t.status in ('COMPLETED', 'CANCELLED')
         and (p_before is null or t.created_at < p_before)
       order by t.created_at desc, t.id desc
       limit v_limit
    ) sub
  ), '[]'::jsonb);
end;
$$;

revoke execute on function
  public.mark_booking_payment(uuid, boolean),
  public.get_driver_payments_to_collect()
from public, anon;

grant execute on function
  public.mark_booking_payment(uuid, boolean),
  public.get_driver_payments_to_collect()
to authenticated;
