-- Ride ratings: after a trip completes, the passenger rates the ride (1-5 stars, optional comment).
--
-- * One rating per app booking, final once given (no edits).
-- * Only the booking's passenger can rate, and only once the booking is COMPLETED.
-- * Writes go through rate_booking(); passengers read their own ratings, admins read all.
--   Drivers have no direct read: on a small trip a comment could identify the passenger.
--
-- get_my_pending_rating   — the latest completed, unrated ride from the last 24 hours (the app prompts for it)
-- get_my_booking          — now includes `rating`
-- get_my_booking_history  — now includes `rating_stars`

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.ride_ratings (
  booking_id    uuid primary key references public.bookings (id),
  trip_id       uuid not null references public.trips (id),
  driver_id     uuid not null references public.drivers (id),  -- snapshot of trips.driver_id
  passenger_id  uuid not null references public.profiles (id),
  stars         smallint not null check (stars between 1 and 5),
  comment       text check (comment is null or char_length(comment) between 1 and 500),
  created_at    timestamptz not null default now()
);

create index ride_ratings_driver_idx on public.ride_ratings (driver_id, created_at desc);
create index ride_ratings_passenger_idx on public.ride_ratings (passenger_id);

alter table public.ride_ratings enable row level security;
grant select on public.ride_ratings to authenticated;

create policy ride_ratings_select on public.ride_ratings for select to authenticated
  using (passenger_id = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Passenger: rate a completed ride
-- ---------------------------------------------------------------------------
create function public.rate_booking(p_booking_id uuid, p_stars smallint, p_comment text default null)
returns public.ride_ratings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_passenger uuid := private.require_role('PASSENGER');
  v_comment text := nullif(btrim(p_comment), '');
  v_booking public.bookings;
  v_rating public.ride_ratings;
begin
  select * into v_booking from public.bookings where id = p_booking_id and passenger_id = v_passenger;
  if not found then
    perform private.raise_error('BOOKING_NOT_FOUND');
  end if;
  if v_booking.status <> 'COMPLETED' then
    perform private.raise_error('INVALID_TRANSITION', format('Only completed rides can be rated; this booking is %s', v_booking.status));
  end if;
  if p_stars is null or p_stars not between 1 and 5 then
    perform private.raise_error('RATING_INVALID', 'Stars must be between 1 and 5');
  end if;
  if char_length(v_comment) > 500 then
    perform private.raise_error('RATING_INVALID', 'Comment must be 500 characters or fewer');
  end if;

  insert into public.ride_ratings (booking_id, trip_id, driver_id, passenger_id, stars, comment)
  select v_booking.id, v_booking.trip_id, t.driver_id, v_passenger, p_stars, v_comment
    from public.trips t
   where t.id = v_booking.trip_id
  on conflict (booking_id) do nothing
  returning * into v_rating;

  if v_rating.booking_id is null then
    perform private.raise_error('ALREADY_RATED');
  end if;
  return v_rating;
end;
$$;

-- ---------------------------------------------------------------------------
-- Passenger: the ride to prompt a rating for, or NULL
-- ---------------------------------------------------------------------------
create function public.get_my_pending_rating()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'booking_id', b.id,
           'code', b.code,
           'completed_at', b.completed_at,
           'origin', o.name,
           'destination', d.name,
           'driver_first_name', split_part(p.full_name, ' ', 1),
           'auto_registration', a.registration_number)
    from public.bookings b
    join public.trips t on t.id = b.trip_id
    join public.routes r on r.id = t.route_id
    join public.stops o on o.id = r.origin_stop_id
    join public.stops d on d.id = r.destination_stop_id
    join public.autos a on a.id = t.auto_id
    join public.profiles p on p.id = t.driver_id
   where b.passenger_id = (select auth.uid())
     and b.status = 'COMPLETED'
     and b.completed_at > now() - interval '24 hours'
     and not exists (select 1 from public.ride_ratings rr where rr.booking_id = b.id)
   order by b.completed_at desc
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Booking reads: add the rating (unchanged otherwise from 20260927000200)
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
               'rating_stars', rr.stars
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

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.rate_booking(uuid, smallint, text),
  public.get_my_pending_rating()
from public, anon;

grant execute on function
  public.rate_booking(uuid, smallint, text),
  public.get_my_pending_rating()
to authenticated;
