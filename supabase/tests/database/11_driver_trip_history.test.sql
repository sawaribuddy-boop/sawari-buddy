-- get_driver_trip_history: own finished trips only, with totals from completed bookings.
begin;
create extension if not exists pgtap with schema extensions;
grant execute on all functions in schema extensions to authenticated, anon;
select no_plan();

\set raj    '00000000-0000-4000-a000-000000000011'
\set suresh '00000000-0000-4000-a000-000000000012'
\set priya  '00000000-0000-4000-a000-000000000021'
\set auto1  '00000000-0000-4000-b000-000000000102'
\set route1 '00000000-0000-4000-d000-000000000001'

set local role authenticated;

-- Raj completes a trip with Priya (2 seats).
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select public.open_trip(:'auto1', :'route1');
select public.driver_heartbeat(28.57, 77.33, 5.0);
select id as trip1 from public.trips where driver_id = :'raj' and status = 'OPEN' \gset

select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select public.book_seats(:'trip1'::uuid, 2::smallint, gen_random_uuid(), 'ANY');
select id as priya_booking from public.bookings where passenger_id = :'priya' and trip_id = :'trip1'::uuid \gset

select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select is(
  (select count(*)::int from jsonb_array_elements(public.get_driver_trip_history()) e where e->>'id' = :'trip1'),
  0, 'an open trip is not in the history');

select public.final_call(:'trip1'::uuid);
select public.mark_boarded(:'priya_booking'::uuid);
select public.start_trip(:'trip1'::uuid);
select public.complete_trip(:'trip1'::uuid);

select is(public.get_driver_trip_history()->0->>'id', :'trip1', 'the completed trip is first');
select is((public.get_driver_trip_history()->0->>'seat_count')::int, 2, 'seat count comes from completed bookings');
select is((public.get_driver_trip_history()->0->>'passenger_count')::int, 1, 'one passenger');
select is((public.get_driver_trip_history()->0->>'fare_paise')::bigint,
          (select total_fare_paise from public.bookings where id = :'priya_booking'::uuid), 'fare total matches the booking');
select is(jsonb_array_length(public.get_driver_trip_history(1)), 1, 'limit is respected');

-- Another driver never sees Raj's trips; passengers cannot call it.
select set_config('request.jwt.claims', jsonb_build_object('sub', :'suresh', 'role', 'authenticated')::text, true);
select is(
  (select count(*)::int from jsonb_array_elements(public.get_driver_trip_history(50)) e where e->>'id' = :'trip1'),
  0, 'other drivers do not see the trip');

select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select throws_ok('select public.get_driver_trip_history()', 'P0001', 'NOT_AUTHORISED', 'passengers cannot read driver history');

select * from finish();
rollback;
