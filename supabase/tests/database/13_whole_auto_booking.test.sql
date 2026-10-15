-- Booking 1 to 4 seats, or the whole auto (every seat of an empty auto).
begin;
create extension if not exists pgtap with schema extensions;
grant execute on all functions in schema extensions to authenticated, anon;
select no_plan();

\set raj    '00000000-0000-4000-a000-000000000011'
\set suresh '00000000-0000-4000-a000-000000000012'
\set priya  '00000000-0000-4000-a000-000000000021'
\set neha   '00000000-0000-4000-a000-000000000022'
\set rahul  '00000000-0000-4000-a000-000000000023'
\set auto_raj    '00000000-0000-4000-b000-000000000102'
\set auto_suresh '00000000-0000-4000-b000-000000000115'
\set route1 '00000000-0000-4000-d000-000000000001'

select is((select max_seats_per_booking from public.platform_settings), 4::smallint, 'up to 4 seats per normal booking');

set local role authenticated;

-- Two 5-seat autos on the same route.
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select id as trip_raj from public.open_trip(:'auto_raj', :'route1') \gset
select public.driver_heartbeat(28.57, 77.33, 5.0);
select set_config('request.jwt.claims', jsonb_build_object('sub', :'suresh', 'role', 'authenticated')::text, true);
select id as trip_suresh from public.open_trip(:'auto_suresh', :'route1') \gset
select public.driver_heartbeat(28.57, 77.33, 5.0);

-- =========================================================================
-- Normal bookings: 4 is allowed, more than 4 is not (unless it is the whole auto)
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select is((public.book_seats(:'trip_suresh', 4::smallint, gen_random_uuid(), 'ANY')).seat_count, 4::smallint,
          'a passenger can book 4 seats');

select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.book_seats(%L, 5::smallint, gen_random_uuid(), %L)', :'trip_suresh', 'ANY'),
                 'P0001', 'NO_SEAT_AVAILABLE', 'the whole auto cannot be booked once someone else is on it');

-- =========================================================================
-- Whole auto
-- =========================================================================
select is((public.book_seats(:'trip_raj', 5::smallint, gen_random_uuid(), 'ANY')).seat_count, 5::smallint,
          'an empty 5-seat auto can be booked whole');
select is((select total_fare_paise from public.bookings where trip_id = :'trip_raj' and passenger_id = :'neha'),
          (select fare_paise * 5 from public.trips where id = :'trip_raj'), 'whole auto fare = 5 x per-seat fare');
select is((select platform_fee_paise from public.bookings where trip_id = :'trip_raj' and passenger_id = :'neha'),
          (select (fare_paise * 5 * 1000 + 5000) / 10000 from public.trips where id = :'trip_raj'),
          'the usual 10% platform fee applies');

select set_config('request.jwt.claims', jsonb_build_object('sub', :'rahul', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.book_seats(%L, 1::smallint, gen_random_uuid(), %L)', :'trip_raj', 'ANY'),
                 'P0001', 'NO_SEAT_AVAILABLE', 'nobody else can book a whole-booked auto');

select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.add_walk_in(%L, 1::smallint, gen_random_uuid())', :'trip_raj'),
                 'P0001', 'NO_SEAT_AVAILABLE', 'the driver cannot add a walk-in to a whole-booked auto');

-- Cancelling the whole-auto booking frees every seat.
select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select public.cancel_booking((select id from public.bookings where trip_id = :'trip_raj' and passenger_id = :'neha'));
select set_config('request.jwt.claims', jsonb_build_object('sub', :'rahul', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.book_seats(%L, 6::smallint, gen_random_uuid(), %L)', :'trip_raj', 'ANY'),
                 'P0001', 'SEAT_COUNT_INVALID', 'more seats than the auto has is refused');
select is((public.book_seats(:'trip_raj', 5::smallint, gen_random_uuid(), 'ANY')).seat_count, 5::smallint,
          'after a cancellation the whole auto can be booked again');

select * from finish();
rollback;
