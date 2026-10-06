-- delete_my_account: anonymises the profile, removes the login, keeps history; refused while busy.
begin;
create extension if not exists pgtap with schema extensions;
grant execute on all functions in schema extensions to authenticated, anon;
select no_plan();

\set admin  '00000000-0000-4000-a000-000000000001'
\set raj    '00000000-0000-4000-a000-000000000011'
\set priya  '00000000-0000-4000-a000-000000000021'
\set auto1  '00000000-0000-4000-b000-000000000102'
\set route1 '00000000-0000-4000-d000-000000000001'
\set tara   '00000000-0000-4000-a000-000000000091'
\set dev    '00000000-0000-4000-a000-000000000092'

-- Fresh accounts (as postgres, before switching role): passenger Tara and driver Dev, with no history.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', :'tara', 'authenticated', 'authenticated', 'tara@test.local', 'x', now(),
        '{"provider":"email"}', '{"full_name":"Tara Singh"}', now(), now(), '', '', '', ''),
       ('00000000-0000-0000-0000-000000000000', :'dev', 'authenticated', 'authenticated', 'dev@test.local', 'x', now(),
        '{"provider":"email"}', '{"full_name":"Dev Patel"}', now(), now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
values (gen_random_uuid(), :'tara', :'tara', 'email', '{}', now(), now()),
       (gen_random_uuid(), :'dev', :'dev', 'email', '{}', now(), now());
update public.profiles set role = 'DRIVER' where id = :'dev';
insert into public.drivers (id, license_number, status, verified_at) values (:'dev', 'DL0000000000099', 'ACTIVE', now());
insert into public.driver_presence (driver_id) values (:'dev');
insert into public.auto_assignments (auto_id, driver_id) values (:'auto1', :'dev');

set local role authenticated;

-- =========================================================================
-- Passenger with no history
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'tara', 'role', 'authenticated')::text, true);
select lives_ok('select public.delete_my_account()', 'passenger can delete their account');

reset role;
select is((select full_name from public.profiles where id = :'tara'), 'Deleted user', 'name is replaced');
select is((select email from public.profiles where id = :'tara'), null, 'profile email is cleared');
select is((select status::text from public.profiles where id = :'tara'), 'SUSPENDED', 'profile is suspended');
select is((select email from auth.users where id = :'tara'), null, 'login email is cleared, so it can be reused');
select is((select banned_until from auth.users where id = :'tara'), 'infinity'::timestamptz, 'login is banned');
select is((select count(*)::int from auth.identities where user_id = :'tara'), 0, 'identities are removed');
set local role authenticated;

-- =========================================================================
-- Driver with no trips and no balance
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'dev', 'role', 'authenticated')::text, true);
select lives_ok('select public.delete_my_account()', 'driver with nothing pending can delete their account');

reset role;
select is((select status::text from public.drivers where id = :'dev'), 'SUSPENDED', 'driver record is suspended');
select is((select count(*)::int from public.auto_assignments where driver_id = :'dev' and revoked_at is null), 0,
          'auto assignments are revoked');
set local role authenticated;

-- =========================================================================
-- Refusals
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'admin', 'role', 'authenticated')::text, true);
select throws_ok('select public.delete_my_account()', 'P0001', 'NOT_AUTHORISED', 'admins cannot delete themselves');

-- Raj opens a trip, Priya books.
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select public.open_trip(:'auto1', :'route1');
select public.driver_heartbeat(28.57, 77.33, 5.0);
select id as trip1 from public.trips where driver_id = :'raj' and status = 'OPEN' \gset
select throws_ok('select public.delete_my_account()', 'P0001', 'ACTIVE_TRIP_EXISTS', 'driver with an open trip is refused');

select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select public.book_seats(:'trip1'::uuid, 1::smallint, gen_random_uuid(), 'ANY');
select id as priya_booking from public.bookings where passenger_id = :'priya' and trip_id = :'trip1'::uuid \gset
select throws_ok('select public.delete_my_account()', 'P0001', 'ACTIVE_BOOKING_EXISTS', 'passenger with an active booking is refused');

-- The ride completes: Raj now owes the platform fee, Priya's booking is history.
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select public.final_call(:'trip1'::uuid);
select public.mark_boarded(:'priya_booking'::uuid);
select public.start_trip(:'trip1'::uuid);
select public.complete_trip(:'trip1'::uuid);
select throws_ok('select public.delete_my_account()', 'P0001', 'SETTLEMENT_PENDING', 'driver with an unsettled balance is refused');

-- =========================================================================
-- Passenger with history: history stays, personal data goes
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select public.rate_booking(:'priya_booking'::uuid, 5::smallint, 'Lovely ride');
select lives_ok('select public.delete_my_account()', 'passenger with past rides can delete their account');

reset role;
select is((select status::text from public.bookings where id = :'priya_booking'::uuid), 'COMPLETED', 'past booking is kept');
select is((select stars::int from public.ride_ratings where booking_id = :'priya_booking'::uuid), 5, 'rating stars are kept');
select is((select comment from public.ride_ratings where booking_id = :'priya_booking'::uuid), null, 'rating comment is removed');

select * from finish();
rollback;
