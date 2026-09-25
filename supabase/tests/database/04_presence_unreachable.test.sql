-- Driver presence: heartbeat, throttling, reachability, unreachable sweep, resume, go offline.
begin;
create extension if not exists pgtap with schema extensions;
grant execute on all functions in schema extensions to authenticated, anon;
select no_plan();

\set raj    '00000000-0000-4000-a000-000000000011'
\set suresh '00000000-0000-4000-a000-000000000012'
\set imran  '00000000-0000-4000-a000-000000000013'
\set priya  '00000000-0000-4000-a000-000000000021'
\set neha   '00000000-0000-4000-a000-000000000022'
\set rahul  '00000000-0000-4000-a000-000000000023'
\set auto_raj    '00000000-0000-4000-b000-000000000102'
\set auto_suresh '00000000-0000-4000-b000-000000000115'
\set auto_imran  '00000000-0000-4000-b000-000000000120'
\set route  '00000000-0000-4000-d000-000000000001'
\set origin '00000000-0000-4000-c000-000000000001'
\set dest   '00000000-0000-4000-c000-000000000002'

set local role authenticated;

-- ---------------- heartbeat ----------------
select set_config('request.jwt.claims', json_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select throws_ok('select public.driver_heartbeat(28.6, 77.4, 5)', 'P0001', 'DRIVER_NOT_ONLINE',
                 'no location tracking while offline');
select id as trip_raj from public.open_trip(:'auto_raj', :'route') \gset
select is(public.driver_heartbeat(28.6, 77.4, 5) ->> 'reason', 'THROTTLED', 'heartbeats closer than the minimum interval are throttled');

reset role;
update public.driver_presence set last_seen_at = now() - interval '5 seconds' where driver_id = :'raj';
set local role authenticated;
select is((public.driver_heartbeat(28.5709, 77.3262, 8) ->> 'accepted')::boolean, true, 'heartbeat with location accepted');
select is((select lat from public.driver_presence where driver_id = :'raj'), 28.5709::double precision, 'latest location stored in place');
select is((select count(*)::int from public.driver_presence where driver_id = :'raj'), 1, 'one presence row per driver (no history rows)');
select throws_ok('select public.driver_heartbeat(95, 77.4, 5)', 'P0001', 'INVALID_LOCATION', 'out-of-range latitude rejected');
select throws_ok('select public.driver_heartbeat(28.6, null, 5)', 'P0001', 'INVALID_LOCATION', 'incomplete coordinates rejected');

reset role;
select ok((select count(*) from realtime.messages where topic = 'trip:' || :'trip_raj' and event = 'location') >= 1,
          'location is broadcast to the trip channel');
update public.driver_presence set last_seen_at = now() - interval '5 seconds' where driver_id = :'raj';
set local role authenticated;
select is((public.driver_heartbeat() ->> 'accepted')::boolean, true, 'heartbeat without GPS still proves reachability');
select is((select lat from public.driver_presence where driver_id = :'raj'), 28.5709::double precision,
          'heartbeat without GPS keeps the last known location');

-- ---------------- stale driver: no new bookings ----------------
reset role;
update public.driver_presence set last_seen_at = now() - interval '61 seconds' where driver_id = :'raj';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.search_trips(:'origin', :'dest') where trip_id = :'trip_raj'), 0,
          'unreachable driver is hidden from search');
select throws_ok(format('select public.book_seats(%L, 1::smallint, gen_random_uuid())', :'trip_raj'), 'P0001', 'DRIVER_UNREACHABLE',
                 'booking rejected when driver heartbeat is stale');

-- Fresh again -> Priya books
reset role;
update public.driver_presence set last_seen_at = now() where driver_id = :'raj';
set local role authenticated;
select id as b_priya from public.book_seats(:'trip_raj', 1::smallint, 'aaaaaaaa-0000-4000-8000-00000000c001') \gset
select is((public.get_my_active_booking() -> 'driver' ->> 'reachable')::boolean, true, 'passenger sees driver reachable');

-- Suresh: empty open trip. Imran: in-progress trip.
select set_config('request.jwt.claims', json_build_object('sub', :'suresh', 'role', 'authenticated')::text, true);
select id as trip_suresh from public.open_trip(:'auto_suresh', :'route') \gset
select set_config('request.jwt.claims', json_build_object('sub', :'imran', 'role', 'authenticated')::text, true);
select id as trip_imran from public.open_trip(:'auto_imran', :'route') \gset
select lives_ok(format('select public.add_walk_in(%L, 1::smallint, gen_random_uuid())', :'trip_imran'), 'imran walk-in');
select lives_ok(format('select public.start_trip(%L)', :'trip_imran'), 'imran departs');

-- ---------------- all three go silent beyond the intervention threshold (600s) ----------------
reset role;
update public.driver_presence set last_seen_at = now() - interval '700 seconds' where driver_id in (:'raj', :'suresh', :'imran');
select is(private.sweep_unreachable_drivers(),
          '{"suspended": 1, "cancelled_empty": 1, "in_progress_flagged": 1, "drivers_offlined": 0}'::jsonb, 'sweep result');
select is((select status::text || '/' || suspended_from_status::text from public.trips where id = :'trip_raj'), 'SUSPENDED/OPEN',
          'trip with bookings is suspended, remembering its prior status');
select is((select status::text from public.bookings where id = :'b_priya'), 'CONFIRMED',
          'bookings are left intact on suspension (for recovery)');
select is((select status::text || '/' || cancel_reason::text from public.trips where id = :'trip_suresh'), 'CANCELLED/DRIVER_UNREACHABLE',
          'empty stale trip is cancelled');
select is((select is_online from public.driver_presence where driver_id = :'suresh'), false, 'vanished driver marked offline');
select is((select status::text from public.trips where id = :'trip_imran'), 'IN_PROGRESS',
          'in-progress trip is NOT suspended (passengers on board)');
select is((select count(*)::int from public.issues where source = 'SYSTEM' and kind = 'DRIVER_UNREACHABLE' and status = 'OPEN'), 2,
          'system issues raised for the suspended and the in-progress trip');
select is(private.sweep_unreachable_drivers() ->> 'in_progress_flagged', '0', 'repeat sweep raises no duplicate issues');
select is((select count(*)::int from public.issues where source = 'SYSTEM'), 2, 'still exactly two system issues');

-- Passengers on a suspended trip can cancel freely; nobody new can book
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.book_seats(%L, 1::smallint, gen_random_uuid())', :'trip_raj'), 'P0001', 'TRIP_NOT_BOOKABLE',
                 'suspended trip is not bookable');

-- Driver comes back and resumes
select set_config('request.jwt.claims', json_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select is((select status::text from public.resume_trip(:'trip_raj')), 'OPEN', 'driver resumes suspended trip to its prior status');
reset role;
select is((select status::text from public.issues where trip_id = :'trip_raj'), 'RESOLVED', 'unreachable issue auto-resolved on resume');
set local role authenticated;

-- ---------------- go offline ----------------
select throws_ok('select public.go_offline()', 'P0001', 'ACTIVE_TRIP_EXISTS', 'cannot go offline with passengers booked');
select set_config('request.jwt.claims', json_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select lives_ok(format('select public.cancel_booking(%L)', :'b_priya'), 'passenger cancels');
select set_config('request.jwt.claims', json_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select is((select is_online from public.go_offline()), false, 'go offline with an empty trip');
select is((select status::text || '/' || cancel_reason::text from public.trips where id = :'trip_raj'), 'CANCELLED/DRIVER_OFFLINE',
          'empty trip auto-cancelled on go offline');
select is((select lat from public.driver_presence where driver_id = :'raj'), null, 'location cleared when offline');
select throws_ok('select public.driver_heartbeat(28.6, 77.4, 5)', 'P0001', 'DRIVER_NOT_ONLINE', 'tracking stops after going offline');

-- Scheduled job is registered
reset role;
select is((select schedule from cron.job where jobname = 'sawari_sweep_unreachable_drivers'), '* * * * *',
          'unreachable sweep scheduled every minute');

select * from finish();
rollback;
