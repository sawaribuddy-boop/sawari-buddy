-- Ride ratings: rate_booking, get_my_pending_rating, rating fields on booking reads, RLS.
begin;
create extension if not exists pgtap with schema extensions;
grant execute on all functions in schema extensions to authenticated, anon;
select no_plan();

\set admin  '00000000-0000-4000-a000-000000000001'
\set raj    '00000000-0000-4000-a000-000000000011'
\set priya  '00000000-0000-4000-a000-000000000021'
\set neha   '00000000-0000-4000-a000-000000000022'
\set auto1  '00000000-0000-4000-b000-000000000102'
\set route1 '00000000-0000-4000-d000-000000000001'

set local role authenticated;

-- =========================================================================
-- Set up: Raj opens a trip, Priya and Neha each book a seat
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select public.open_trip(:'auto1', :'route1');
select public.driver_heartbeat(28.57, 77.33, 5.0);
select id as trip1 from public.trips where driver_id = :'raj' and status = 'OPEN' \gset

select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select public.book_seats(:'trip1'::uuid, 1::smallint, gen_random_uuid(), 'ANY');
select id as priya_booking from public.bookings where passenger_id = :'priya' and trip_id = :'trip1'::uuid \gset

select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select public.book_seats(:'trip1'::uuid, 1::smallint, gen_random_uuid(), 'ANY');
select id as neha_booking from public.bookings where passenger_id = :'neha' and trip_id = :'trip1'::uuid \gset

-- Before completion: nothing to rate, and rating is refused.
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select is(public.get_my_pending_rating(), null, 'no pending rating before the ride completes');
select throws_ok(
  format('select public.rate_booking(%L, 5::smallint)', :'priya_booking'),
  'P0001', 'INVALID_TRANSITION', 'cannot rate a ride that is not completed');

-- Neha cancels; Raj boards Priya and completes the trip.
select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select public.cancel_booking(:'neha_booking'::uuid);

select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select public.final_call(:'trip1'::uuid);
select public.mark_boarded(:'priya_booking'::uuid);
select public.start_trip(:'trip1'::uuid);
select public.complete_trip(:'trip1'::uuid);

-- =========================================================================
-- Pending rating
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select is(public.get_my_pending_rating()->>'booking_id', :'priya_booking', 'completed ride is pending a rating');
select is(public.get_my_booking(:'priya_booking'::uuid)->'rating', 'null'::jsonb, 'booking detail has no rating yet');

select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select is(public.get_my_pending_rating(), null, 'a cancelled booking is never pending a rating');
select throws_ok(
  format('select public.rate_booking(%L, 4::smallint)', :'neha_booking'),
  'P0001', 'INVALID_TRANSITION', 'cannot rate a cancelled booking');
select throws_ok(
  format('select public.rate_booking(%L, 1::smallint)', :'priya_booking'),
  'P0001', 'BOOKING_NOT_FOUND', 'cannot rate someone else''s booking');

-- =========================================================================
-- Validation
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select throws_ok(
  format('select public.rate_booking(%L, 0::smallint)', :'priya_booking'),
  'P0001', 'RATING_INVALID', 'stars below 1 are rejected');
select throws_ok(
  format('select public.rate_booking(%L, 6::smallint)', :'priya_booking'),
  'P0001', 'RATING_INVALID', 'stars above 5 are rejected');
select throws_ok(
  format('select public.rate_booking(%L, 5::smallint, %L)', :'priya_booking', repeat('x', 501)),
  'P0001', 'RATING_INVALID', 'comments over 500 characters are rejected');

-- =========================================================================
-- Rate
-- =========================================================================
select is(
  (public.rate_booking(:'priya_booking'::uuid, 4::smallint, '  Safe driver  ')).comment,
  'Safe driver', 'rating is stored with a trimmed comment');
select is(
  (select driver_id from public.ride_ratings where booking_id = :'priya_booking'::uuid),
  :'raj'::uuid, 'rating records the trip''s driver');
select throws_ok(
  format('select public.rate_booking(%L, 5::smallint)', :'priya_booking'),
  'P0001', 'ALREADY_RATED', 'a ride can be rated only once');

select is(public.get_my_pending_rating(), null, 'nothing pending once rated');
select is((public.get_my_booking(:'priya_booking'::uuid)->'rating'->>'stars')::int, 4, 'booking detail shows the rating');
select is((public.get_my_booking_history()->0->>'rating_stars')::int, 4, 'history shows the stars');

-- Only passengers can rate.
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select throws_ok(
  format('select public.rate_booking(%L, 5::smallint)', :'priya_booking'),
  'P0001', 'NOT_AUTHORISED', 'drivers cannot rate');

-- =========================================================================
-- RLS: passenger sees own, driver sees none, admin sees all; no direct writes
-- =========================================================================
select is((select count(*)::int from public.ride_ratings), 0, 'driver cannot read ratings directly');

select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.ride_ratings), 0, 'other passengers cannot read the rating');

select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.ride_ratings), 1, 'passenger reads their own rating');
select throws_ok(
  format('insert into public.ride_ratings (booking_id, trip_id, driver_id, passenger_id, stars) values (%L, %L, %L, %L, 5)',
         :'neha_booking', :'trip1', :'raj', :'priya'),
  '42501', null, 'passengers cannot insert ratings directly');
select throws_ok(
  'update public.ride_ratings set stars = 5',
  '42501', null, 'passengers cannot edit a rating');

select set_config('request.jwt.claims', jsonb_build_object('sub', :'admin', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.ride_ratings), 1, 'admin reads all ratings');

select * from finish();
rollback;
