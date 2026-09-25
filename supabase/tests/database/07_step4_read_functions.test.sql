-- Step 4 read functions: get_my_booking_history, get_my_booking, get_driver_home.
-- Tests authorization (own data only, cross-user blocked), correctness of returned fields,
-- pagination, and role enforcement.
begin;
create extension if not exists pgtap with schema extensions;
grant execute on all functions in schema extensions to authenticated, anon;
select no_plan();

\set raj    '00000000-0000-4000-a000-000000000011'
\set suresh '00000000-0000-4000-a000-000000000012'
\set priya  '00000000-0000-4000-a000-000000000021'
\set neha   '00000000-0000-4000-a000-000000000022'
\set rahul  '00000000-0000-4000-a000-000000000023'
\set auto1  '00000000-0000-4000-b000-000000000102'
\set route1 '00000000-0000-4000-d000-000000000001'
\set origin '00000000-0000-4000-c000-000000000001'
\set dest   '00000000-0000-4000-c000-000000000002'

set local role authenticated;

-- =========================================================================
-- Set up: Raj opens a trip, Priya books, trip completes
-- =========================================================================

-- Raj opens a trip (open_trip sets is_online = true and creates presence row)
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select public.open_trip(:'auto1', :'route1');
-- Now heartbeat to set location (needed for search_trips / reachability)
select public.driver_heartbeat(28.57, 77.33, 5.0);

-- Grab the trip ID
\set trip1 ''
select id as trip1 from public.trips where driver_id = :'raj' and status = 'OPEN' \gset

-- Priya books 2 seats
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select public.book_seats(:'trip1'::uuid, 2::smallint, gen_random_uuid(), 'ANY');

-- Grab Priya's booking
\set priya_booking ''
select id as priya_booking from public.bookings where passenger_id = :'priya' and trip_id = :'trip1'::uuid \gset

-- Neha books 1 seat
select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select public.book_seats(:'trip1'::uuid, 1::smallint, gen_random_uuid(), 'BACK');

\set neha_booking ''
select id as neha_booking from public.bookings where passenger_id = :'neha' and trip_id = :'trip1'::uuid \gset

-- Neha cancels her own booking
select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select public.cancel_booking(:'neha_booking'::uuid);

-- Raj: final call, board Priya, start, complete
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select public.final_call(:'trip1'::uuid);
select public.mark_boarded(:'priya_booking'::uuid);
select public.start_trip(:'trip1'::uuid);
select public.complete_trip(:'trip1'::uuid);

-- =========================================================================
-- get_my_booking_history: Priya sees her own bookings
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);

select isnt(
  public.get_my_booking_history(),
  '[]'::jsonb,
  'Priya has at least one booking in history'
);

select is(
  jsonb_array_length(public.get_my_booking_history()),
  1,
  'Priya has exactly 1 booking'
);

-- Check the returned fields
select is(
  (public.get_my_booking_history()->0->>'status'),
  'COMPLETED',
  'Priya''s booking status is COMPLETED'
);

select is(
  (public.get_my_booking_history()->0->>'origin'),
  'Station 1 (Metro)',
  'Origin stop name returned'
);

select is(
  (public.get_my_booking_history()->0->>'destination'),
  'Dream City',
  'Destination stop name returned'
);

select is(
  (public.get_my_booking_history()->0->>'driver_first_name'),
  'Raj',
  'Driver first name only (privacy)'
);

select is(
  (public.get_my_booking_history()->0->>'seat_count')::integer,
  2,
  'Seat count is 2'
);

select ok(
  (public.get_my_booking_history()->0->>'code') like 'SA%',
  'Booking code starts with SA'
);

-- =========================================================================
-- get_my_booking_history: cross-user isolation
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'rahul', 'role', 'authenticated')::text, true);

select is(
  public.get_my_booking_history(),
  '[]'::jsonb,
  'Rahul (no bookings) gets empty array'
);

-- =========================================================================
-- get_my_booking_history: Neha sees her cancelled booking
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);

select is(
  jsonb_array_length(public.get_my_booking_history()),
  1,
  'Neha has 1 booking (cancelled)'
);

select is(
  (public.get_my_booking_history()->0->>'status'),
  'CANCELLED',
  'Neha''s booking shows as CANCELLED'
);

-- =========================================================================
-- get_my_booking_history: pagination
-- =========================================================================
-- Create a second trip so Priya can have a second booking
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select public.open_trip(:'auto1', :'route1');
select public.driver_heartbeat(28.57, 77.33, 5.0);

\set trip2 ''
select id as trip2 from public.trips where driver_id = :'raj' and status = 'OPEN' \gset

select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select public.book_seats(:'trip2'::uuid, 1::smallint, gen_random_uuid(), 'ANY');

-- now() is frozen in a test transaction, so both bookings share the same created_at.
-- Shift the newer booking forward so the cursor-based pagination test works.
reset role;
update public.bookings set created_at = created_at + interval '1 second'
 where passenger_id = :'priya' and trip_id = :'trip2'::uuid;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);

-- Now Priya has 2 bookings (1 completed + 1 confirmed on trip2)
select is(
  jsonb_array_length(public.get_my_booking_history()),
  2,
  'Priya now has 2 bookings'
);

-- Paginate with limit 1
select is(
  jsonb_array_length(public.get_my_booking_history(1)),
  1,
  'Limit 1 returns exactly 1 row'
);

-- The first row (newest) is the CONFIRMED one on trip2
select is(
  (public.get_my_booking_history(1)->0->>'status'),
  'CONFIRMED',
  'Newest booking (CONFIRMED on trip2) first'
);

-- Paginate: use that row's created_at as cursor
select is(
  jsonb_array_length(public.get_my_booking_history(
    10,
    (public.get_my_booking_history(1)->0->>'created_at')::timestamptz
  )),
  1,
  'Cursor pagination returns next page (1 older booking)'
);

select is(
  (public.get_my_booking_history(10, (public.get_my_booking_history(1)->0->>'created_at')::timestamptz)->0->>'status'),
  'COMPLETED',
  'Older booking on page 2 is the COMPLETED one'
);

-- =========================================================================
-- get_my_booking_history: driver cannot call it on behalf of passenger
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);

select is(
  public.get_my_booking_history(),
  '[]'::jsonb,
  'Driver Raj has no passenger bookings'
);

-- =========================================================================
-- get_my_booking: Priya sees her own booking
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);

select isnt(
  public.get_my_booking(:'priya_booking'::uuid),
  null::jsonb,
  'Priya can read her own booking'
);

select is(
  (public.get_my_booking(:'priya_booking'::uuid)->'booking'->>'id'),
  :'priya_booking',
  'Booking ID matches'
);

select is(
  (public.get_my_booking(:'priya_booking'::uuid)->'booking'->>'status'),
  'COMPLETED',
  'Booking status is COMPLETED'
);

select is(
  (public.get_my_booking(:'priya_booking'::uuid)->'route'->>'origin'),
  'Station 1 (Metro)',
  'Route origin returned'
);

select is(
  (public.get_my_booking(:'priya_booking'::uuid)->'driver'->>'first_name'),
  'Raj',
  'Driver first name returned'
);

select ok(
  (public.get_my_booking(:'priya_booking'::uuid)->'auto'->>'registration_number') is not null,
  'Auto registration returned'
);

-- =========================================================================
-- get_my_booking: cross-user blocked
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);

select is(
  public.get_my_booking(:'priya_booking'::uuid),
  null::jsonb,
  'Neha cannot see Priya''s booking (returns null)'
);

-- =========================================================================
-- get_my_booking: non-existent booking
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);

select is(
  public.get_my_booking('00000000-0000-0000-0000-000000000099'::uuid),
  null::jsonb,
  'Non-existent booking returns null'
);

-- =========================================================================
-- get_my_booking: driver cannot read passenger's booking via this function
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);

select is(
  public.get_my_booking(:'priya_booking'::uuid),
  null::jsonb,
  'Driver cannot use get_my_booking for a passenger booking'
);

-- =========================================================================
-- get_driver_home: Raj sees his dashboard
-- =========================================================================
-- Cancel trip2 so Raj has no active trip
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select public.cancel_trip(:'trip2'::uuid, 'DRIVER_CANCELLED');
-- After cancel, driver is still online (presence.is_online stays true, active_trip_id cleared)

select isnt(
  public.get_driver_home(),
  null::jsonb,
  'Raj can call get_driver_home'
);

-- Check presence (is_online stays true from the trip that was just cancelled)
select is(
  (public.get_driver_home()->'presence'->>'is_online')::boolean,
  true,
  'Presence shows online'
);

-- No active trip (JSON null)
select ok(
  (public.get_driver_home()->>'active_trip') is null,
  'No active trip after cancellation'
);

-- Auto info present
select is(
  (public.get_driver_home()->'auto'->>'registration_number'),
  'DL01AB1234',
  'Auto registration returned'
);

-- Earnings present (even if zero for today — but we completed a trip earlier)
select ok(
  (public.get_driver_home()->'earnings') is not null,
  'Earnings object returned'
);

select ok(
  (public.get_driver_home()->'server_time') is not null,
  'Server time returned'
);

-- =========================================================================
-- get_driver_home: with an active trip shows manifest
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select public.open_trip(:'auto1', :'route1');

\set trip3 ''
select id as trip3 from public.trips where driver_id = :'raj' and status = 'OPEN' \gset

-- Priya books on the new trip (her old booking on trip2 was cancelled)
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select public.book_seats(:'trip3'::uuid, 1::smallint, gen_random_uuid(), 'ANY');

-- Back to Raj
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);

select isnt(
  (public.get_driver_home()->'active_trip'),
  null::jsonb,
  'Active trip is present after opening trip3'
);

select is(
  (public.get_driver_home()->'active_trip'->'trip'->>'status'),
  'OPEN',
  'Active trip status is OPEN'
);

select is(
  (public.get_driver_home()->'active_trip'->>'occupied_seats')::integer,
  1,
  'Occupied seats = 1 (Priya)'
);

select is(
  jsonb_array_length(public.get_driver_home()->'active_trip'->'bookings'),
  1,
  'One booking in manifest'
);

select is(
  (public.get_driver_home()->'active_trip'->'bookings'->0->>'passenger_first_name'),
  'Priya',
  'Passenger first name in manifest (privacy: no last name)'
);

select is(
  (public.get_driver_home()->'active_trip'->'route'->>'origin'),
  'Station 1 (Metro)',
  'Route in active trip'
);

-- =========================================================================
-- get_driver_home: cross-driver isolation
-- =========================================================================
\set auto2  '00000000-0000-4000-b000-000000000115'
\set route2 '00000000-0000-4000-d000-000000000002'

select set_config('request.jwt.claims', jsonb_build_object('sub', :'suresh', 'role', 'authenticated')::text, true);
-- Suresh opens (and immediately cancels) a trip just to get an online presence row
select public.open_trip(:'auto2', :'route2');
\set suresh_trip ''
select id as suresh_trip from public.trips where driver_id = :'suresh' and status = 'OPEN' \gset
select public.cancel_trip(:'suresh_trip'::uuid, 'DRIVER_CANCELLED');

select ok(
  (public.get_driver_home()->>'active_trip') is null,
  'Suresh sees no active trip (it is Raj''s)'
);

select isnt(
  (public.get_driver_home()->'auto'->>'registration_number'),
  'DL01AB1234',
  'Suresh sees his own auto, not Raj''s'
);

-- =========================================================================
-- get_driver_home: passenger cannot call it
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);

select throws_ok(
  'select public.get_driver_home()',
  'P0001',
  'NOT_AUTHORISED',
  'Passenger cannot call get_driver_home'
);

-- =========================================================================
-- Cleanup: cancel trip3 for clean state
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select public.cancel_trip(:'trip3'::uuid, 'DRIVER_CANCELLED');

select * from finish();
rollback;
