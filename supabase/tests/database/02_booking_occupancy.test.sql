-- Booking engine: occupancy (APP + WALK-IN), guards, idempotency, no-show grace, boarding.
-- Uses seed data: driver Raj (…011) with auto DL01AB1234 (capacity 5), route Station 1 -> Dream City (₹30),
-- passengers Priya (…021), Neha (…022), Rahul (…023).
begin;
create extension if not exists pgtap with schema extensions;
grant execute on all functions in schema extensions to authenticated, anon;
select no_plan();

\set raj    '00000000-0000-4000-a000-000000000011'
\set priya  '00000000-0000-4000-a000-000000000021'
\set neha   '00000000-0000-4000-a000-000000000022'
\set rahul  '00000000-0000-4000-a000-000000000023'
\set auto   '00000000-0000-4000-b000-000000000102'
\set route  '00000000-0000-4000-d000-000000000001'
\set origin '00000000-0000-4000-c000-000000000001'
\set dest   '00000000-0000-4000-c000-000000000002'

set local role authenticated;

-- Driver goes online on the route
select set_config('request.jwt.claims', json_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select id as trip_id from public.open_trip(:'auto', :'route') \gset
select is((select status::text from public.trips where id = :'trip_id'), 'OPEN', 'driver opens an OPEN trip');
select is((select capacity::int from public.trips where id = :'trip_id'), 5, 'trip snapshots auto capacity');

-- Priya books 2 seats
select set_config('request.jwt.claims', json_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select id as b_priya from public.book_seats(:'trip_id', 2::smallint, 'aaaaaaaa-0000-4000-8000-000000000001') \gset
select is((select status::text from public.bookings where id = :'b_priya'), 'CONFIRMED', 'app booking is CONFIRMED');
select is((select total_fare_paise from public.bookings where id = :'b_priya'), 6000::bigint, 'total fare = 2 x ₹30');
select is((select platform_fee_paise from public.bookings where id = :'b_priya'), 600::bigint, 'platform fee snapshotted at 10%');
select matches((select code from public.bookings where id = :'b_priya'), '^SA[0-9]{4,}$', 'human-readable booking code');

-- Idempotency: same key returns the same booking, never a second row
select is((select id from public.book_seats(:'trip_id', 2::smallint, 'aaaaaaaa-0000-4000-8000-000000000001')),
          :'b_priya'::uuid, 'retry with same idempotency key returns the original booking');
select is((select count(*)::int from public.bookings where passenger_id = :'priya'), 1, 'retry created no extra booking');
select throws_ok(format('select public.book_seats(%L, 1::smallint, %L)', :'trip_id', 'aaaaaaaa-0000-4000-8000-000000000001'),
                 'P0001', 'IDEMPOTENCY_KEY_REUSED', 'same key with different parameters is rejected');
select throws_ok(format('select public.book_seats(%L, 1::smallint, %L)', :'trip_id', 'aaaaaaaa-0000-4000-8000-000000000002'),
                 'P0001', 'ALREADY_HAS_ACTIVE_BOOKING', 'one active booking per passenger');

-- Neha: seat limit, then 1 seat
select set_config('request.jwt.claims', json_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.book_seats(%L, 4::smallint, %L)', :'trip_id', 'bbbbbbbb-0000-4000-8000-000000000001'),
                 'P0001', 'SEAT_COUNT_INVALID', 'seat count above max_seats_per_booking is rejected');
select id as b_neha from public.book_seats(:'trip_id', 1::smallint, 'bbbbbbbb-0000-4000-8000-000000000002') \gset

-- Driver adds a walk-in: occupancy = 2 (Priya) + 1 (Neha) + 1 (walk-in) = 4 of 5
select set_config('request.jwt.claims', json_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select id as w1 from public.add_walk_in(:'trip_id', 1::smallint, 'cccccccc-0000-4000-8000-000000000001', 'Blue shirt') \gset
select is((select status::text from public.bookings where id = :'w1'), 'BOARDED', 'walk-in starts BOARDED');
select is((select id from public.add_walk_in(:'trip_id', 1::smallint, 'cccccccc-0000-4000-8000-000000000001')),
          :'w1'::uuid, 'walk-in retry with same key does not add a second passenger');
select is((public.get_trip_manifest(:'trip_id') ->> 'occupied_seats')::int, 4, 'occupied = app 3 + walk-in 1');
select is((public.get_trip_manifest(:'trip_id') ->> 'available_seats')::int, 1, 'available = 5 - 4');
select throws_ok(format('select public.add_walk_in(%L, 2::smallint, %L)', :'trip_id', 'cccccccc-0000-4000-8000-000000000002'),
                 'P0001', 'NO_SEAT_AVAILABLE', 'walk-in cannot exceed capacity');

-- Rahul: 2 seats do not fit, 1 does -> trip full
select set_config('request.jwt.claims', json_build_object('sub', :'rahul', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.book_seats(%L, 2::smallint, %L)', :'trip_id', 'dddddddd-0000-4000-8000-000000000001'),
                 'P0001', 'NO_SEAT_AVAILABLE', 'booking more seats than available is rejected');
select id as b_rahul from public.book_seats(:'trip_id', 1::smallint, 'dddddddd-0000-4000-8000-000000000002') \gset
select is((select count(*)::int from public.search_trips(:'origin', :'dest')), 0, 'full trip is hidden from search');

-- Neha cancels -> a seat frees up
select set_config('request.jwt.claims', json_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.cancel_booking(%L)', :'b_priya'), 'P0001', 'BOOKING_NOT_FOUND',
                 'a passenger cannot cancel someone else''s booking');
select is((select status::text from public.cancel_booking(:'b_neha')), 'CANCELLED', 'passenger cancels before boarding');
select is((select status::text from public.cancel_booking(:'b_neha')), 'CANCELLED', 'cancel is idempotent');
select is((select available_seats from public.search_trips(:'origin', :'dest')), 1, 'search shows the freed seat');

-- No-show rules
select set_config('request.jwt.claims', json_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.mark_no_show(%L)', :'b_rahul'), 'P0001', 'FINAL_CALL_REQUIRED',
                 'no-show needs a final call first');
select is((select status::text from public.final_call(:'trip_id')), 'BOARDING', 'final call moves trip to BOARDING');
select ok((select no_show_eligible_at = final_call_at + interval '300 seconds' from public.trips where id = :'trip_id'),
          'no_show_eligible_at = final_call_at + configured grace (300s)');
select is((select status::text from public.bookings where id = :'b_rahul'), 'CONFIRMED',
          'a passenger waiting to board stays CONFIRMED after final call');
select throws_ok(format('select public.mark_no_show(%L)', :'b_rahul'), 'P0001', 'GRACE_PERIOD_NOT_ELAPSED',
                 'no-show rejected before the grace period ends');

select set_config('request.jwt.claims', json_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.book_seats(%L, 1::smallint, %L)', :'trip_id', 'bbbbbbbb-0000-4000-8000-000000000003'),
                 'P0001', 'TRIP_NOT_BOOKABLE', 'app bookings close at final call');

-- Simulate the grace period elapsing (the test transaction's clock is frozen)
reset role;
update public.trips
   set final_call_at = now() - interval '301 seconds', no_show_eligible_at = now() - interval '1 second'
 where id = :'trip_id';
set local role authenticated;

select set_config('request.jwt.claims', json_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select is((select status::text from public.mark_no_show(:'b_rahul')), 'NO_SHOW', 'no-show allowed after grace period');
select is((public.get_trip_manifest(:'trip_id') ->> 'available_seats')::int, 2, 'no-show releases the seat (plus Neha''s)');
select lives_ok(format('select public.add_walk_in(%L, 2::smallint, %L)', :'trip_id', 'cccccccc-0000-4000-8000-000000000003'),
                'freed seats can be filled by walk-ins during boarding');
select is((public.get_trip_manifest(:'trip_id') ->> 'available_seats')::int, 0, 'trip full again');

-- Start requires every booked passenger to be resolved
select throws_ok(format('select public.start_trip(%L)', :'trip_id'), 'P0001', 'PASSENGERS_PENDING',
                 'cannot start while an app passenger is still expected');
select is((select status::text from public.mark_boarded(:'b_priya')), 'BOARDED', 'driver marks passenger boarded');
select is((select status::text from public.mark_boarded(:'b_priya')), 'BOARDED', 'mark_boarded is idempotent');
select is((select status::text from public.start_trip(:'trip_id')), 'IN_PROGRESS', 'trip starts');
select throws_ok(format('select public.add_walk_in(%L, 1::smallint, %L)', :'trip_id', 'cccccccc-0000-4000-8000-000000000004'),
                 'P0001', 'TRIP_NOT_ACCEPTING_WALK_INS', 'no walk-ins once departed (V1: whole-route fares)');

select set_config('request.jwt.claims', json_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.cancel_booking(%L)', :'b_priya'), 'P0001', 'INVALID_TRANSITION',
                 'cannot cancel after boarding');

-- Direct table writes are impossible for clients
select throws_ok(format('update public.bookings set status = %L where id = %L', 'CANCELLED', :'b_priya'),
                 '42501', null, 'clients cannot update bookings directly');
select throws_ok(format('insert into public.bookings (trip_id, source, passenger_id, seat_count, status, fare_per_seat_paise, total_fare_paise, platform_fee_paise, idempotency_key, created_by) values (%L, %L, %L, 1, %L, 3000, 3000, 0, gen_random_uuid(), %L)',
                        :'trip_id', 'APP', :'priya', 'CONFIRMED', :'priya'),
                 '42501', null, 'clients cannot insert bookings directly');

-- Audit trail
reset role;
select is((select array_agg(to_status::text order by id) from public.booking_events where booking_id = :'b_priya'),
          array['CONFIRMED', 'BOARDED'], 'every booking transition is audited');
select is((select array_agg(to_status::text order by id) from public.trip_events where trip_id = :'trip_id'),
          array['OPEN', 'BOARDING', 'IN_PROGRESS'], 'every trip transition is audited');

-- Backstop: even a privileged direct insert cannot overbook
select throws_ok(format('insert into public.bookings (trip_id, source, walk_in_label, seat_count, status, boarded_at, fare_per_seat_paise, total_fare_paise, platform_fee_paise, idempotency_key, created_by) values (%L, %L, null, 1, %L, now(), 3000, 3000, 0, gen_random_uuid(), %L)',
                        :'trip_id', 'WALK_IN', 'BOARDED', :'raj'),
                 'P0001', 'NO_SEAT_AVAILABLE', 'capacity trigger blocks overbooking on any write path');
select throws_ok(format('update public.bookings set status = %L where id = %L', 'CONFIRMED', :'b_rahul'),
                 'P0001', 'INVALID_TRANSITION', 'terminal booking states cannot be reopened');

select * from finish();
rollback;
