-- Row Level Security and privilege boundaries per role.
begin;
create extension if not exists pgtap with schema extensions;
grant execute on all functions in schema extensions to authenticated, anon;
select no_plan();

\set admin  '00000000-0000-4000-a000-000000000001'
\set raj    '00000000-0000-4000-a000-000000000011'
\set suresh '00000000-0000-4000-a000-000000000012'
\set priya  '00000000-0000-4000-a000-000000000021'
\set neha   '00000000-0000-4000-a000-000000000022'
\set auto_raj    '00000000-0000-4000-b000-000000000102'
\set auto_suresh '00000000-0000-4000-b000-000000000115'
\set route  '00000000-0000-4000-d000-000000000001'

-- Fixture: Raj and Suresh each open a trip; Priya books on Raj's trip.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select id as trip_raj from public.open_trip(:'auto_raj', :'route') \gset
select set_config('request.jwt.claims', json_build_object('sub', :'suresh', 'role', 'authenticated')::text, true);
select id as trip_suresh from public.open_trip(:'auto_suresh', :'route') \gset
select set_config('request.jwt.claims', json_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select id as b_priya from public.book_seats(:'trip_raj', 1::smallint, 'aaaaaaaa-0000-4000-8000-00000000a001') \gset

-- ---------------- anon: nothing ----------------
reset role;
set local role anon;
select throws_ok('select count(*) from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select count(*) from public.routes', '42501', null, 'anon cannot read routes');
select throws_ok(format('select public.search_trips(%L, %L)', :'route', :'route'), '42501', null, 'anon cannot call RPCs');

-- ---------------- passenger ----------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.profiles), 1, 'passenger sees only their own profile');
select is((select count(*)::int from public.bookings), 1, 'passenger sees only their own bookings');
select is((select array_agg(id) from public.trips), array[:'trip_raj'::uuid], 'passenger sees only trips they booked');
select is((select count(*)::int from public.driver_presence), 0, 'passenger cannot read driver presence/location table');
select is((select count(*)::int from public.platform_settings), 0, 'passenger cannot read raw settings');
select ok((public.get_platform_settings_public() ->> 'max_seats_per_booking') is not null, 'passenger reads public settings');
select ok((select count(*) from public.routes) > 0, 'passenger reads active routes');
select lives_ok($$update public.profiles set full_name = 'Priya S' where id = (select auth.uid())$$, 'passenger updates own name');
select throws_ok($$update public.profiles set role = 'ADMIN' where id = (select auth.uid())$$, '42501', null,
                 'passenger cannot change own role');
select throws_ok($$insert into public.stops (name, lat, lng) values ('Hack Stop', 1, 1)$$, '42501', null,
                 'passenger cannot create stops');
select throws_ok(format('select public.admin_set_user_role(%L, %L)', :'priya', 'ADMIN'), 'P0001', 'NOT_AUTHORISED',
                 'passenger cannot call admin RPCs');
select throws_ok(format('select public.open_trip(%L, %L)', :'auto_raj', :'route'), 'P0001', 'NOT_AUTHORISED',
                 'passenger cannot act as a driver');
select throws_ok('select private.sweep_unreachable_drivers()', '42501', null, 'passenger cannot run internal jobs');
select throws_ok(format('select public.get_trip_manifest(%L)', :'trip_raj'), 'P0001', 'TRIP_NOT_FOUND',
                 'passenger cannot read the driver manifest');
select ok(private.can_join_trip_channel('trip:' || :'trip_raj'), 'passenger can join realtime channel of their trip');
select ok(not private.can_join_trip_channel('trip:' || :'trip_suresh'), 'passenger cannot join another trip channel');
select ok(not private.can_join_trip_channel('trip:not-a-uuid'), 'malformed topics are rejected');

select set_config('request.jwt.claims', json_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.bookings), 0, 'another passenger cannot see Priya''s booking');
select is((select count(*)::int from public.trips), 0, 'passenger without bookings sees no trips');
select is(public.get_my_active_booking(), null, 'no active booking for Neha');

-- ---------------- driver ----------------
select set_config('request.jwt.claims', json_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select is((select array_agg(id) from public.trips), array[:'trip_raj'::uuid], 'driver sees only own trips');
select is((select count(*)::int from public.bookings where trip_id = :'trip_raj'), 1, 'driver sees bookings on own trip');
select is((select count(*)::int from public.profiles), 1, 'driver cannot read passenger profiles (phone/email) directly');
select is(public.get_trip_manifest(:'trip_raj') -> 'bookings' -> 0 ->> 'passenger_first_name', 'Priya',
          'driver sees passenger first name via manifest');
select is((select array_agg(id) from public.autos), array[:'auto_raj'::uuid], 'driver sees only assigned autos');
select is((select count(*)::int from public.driver_presence), 1, 'driver sees only own presence');
select throws_ok(format('select public.get_trip_manifest(%L)', :'trip_suresh'), 'P0001', 'TRIP_NOT_FOUND',
                 'driver cannot read another driver''s trip');
select throws_ok(format('select public.final_call(%L)', :'trip_suresh'), 'P0001', 'TRIP_NOT_FOUND',
                 'driver cannot act on another driver''s trip');
select throws_ok(format('select public.book_seats(%L, 1::smallint, gen_random_uuid())', :'trip_raj'), 'P0001', 'NOT_AUTHORISED',
                 'driver cannot book as a passenger');
select throws_ok($$update public.trips set status = 'CANCELLED'$$, '42501', null, 'driver cannot update trips directly');
update public.autos set capacity = 8;  -- RLS: silently matches no rows for a non-admin
reset role;
select is((select capacity::int from public.autos where id = :'auto_raj'), 5, 'driver cannot edit autos (RLS filters the update)');
set local role authenticated;

-- ---------------- admin ----------------
select set_config('request.jwt.claims', json_build_object('sub', :'admin', 'role', 'authenticated')::text, true);
select ok((select count(*) from public.profiles) >= 7, 'admin reads all profiles');
select is((select count(*)::int from public.trips where id in (:'trip_raj', :'trip_suresh')), 2, 'admin reads all trips');
select is((select count(*)::int from public.platform_settings), 1, 'admin reads settings');
select lives_ok($$insert into public.stops (name, lat, lng) values ('Admin Stop', 28.6, 77.4)$$, 'admin creates stops');
select lives_ok($$update public.platform_settings set no_show_grace_seconds = 240 where id = 1$$, 'admin updates settings');
select is((select count(*)::int from public.settings_events), 1, 'settings changes are audited');
select throws_ok($$update public.trips set status = 'CANCELLED'$$, '42501', null,
                 'even admins change trips only through RPCs');

select * from finish();
rollback;
