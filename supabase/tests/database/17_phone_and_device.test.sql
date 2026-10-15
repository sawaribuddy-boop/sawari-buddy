-- One account per verified mobile number and one sign-up per device; the phone-verification switch.
begin;
create extension if not exists pgtap with schema extensions;
grant execute on all functions in schema extensions to authenticated, anon;
select no_plan();

\set raj    '00000000-0000-4000-a000-000000000011'
\set priya  '00000000-0000-4000-a000-000000000021'
\set new1   '00000000-0000-4000-e000-000000000001'
\set new2   '00000000-0000-4000-e000-000000000002'
\set new3   '00000000-0000-4000-e000-000000000003'
\set new4   '00000000-0000-4000-e000-000000000004'
\set dev1   'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
\set dev2   'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

-- What Supabase Auth inserts on an e-mail sign-up, with the app's metadata.
create function pg_temp.sign_up(p_id uuid, p_email text, p_meta jsonb) returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, p_meta, now(), now());
$$;

-- =========================================================================
-- Seed users' verified numbers reach their profiles
-- =========================================================================
select is((select phone from public.profiles where id = :'priya'), '+919876500004', 'a verified number is copied to the profile');

-- =========================================================================
-- check_sign_up (signed out)
-- =========================================================================
set local role anon;
select is(public.check_sign_up(' +91 98765 00004 ', :'dev1'),
          '{"phone_registered": true, "device_registered": false}'::jsonb, 'a verified number is reported as taken');
select is(public.check_sign_up('+919876500010', null),
          '{"phone_registered": false, "device_registered": false}'::jsonb, 'a free number and no device');
reset role;

-- =========================================================================
-- Sign-up rules (enforced by the auth.users trigger)
-- =========================================================================
select lives_ok(format('select pg_temp.sign_up(%L, %L, %L)', :'new1', 'new1@example.com',
                       jsonb_build_object('full_name', 'New One', 'phone', '+919876500010', 'device_id', :'dev1')),
                'sign-up with a free number on a new device');
select is((select phone from public.profiles where id = :'new1'), null, 'the typed number is not on the profile until verified');
set local role anon;
select is((public.check_sign_up(null, upper(:'dev1'))->>'device_registered')::boolean, true, 'the device is now registered');
reset role;

select throws_ok(format('select pg_temp.sign_up(%L, %L, %L)', :'new2', 'new2@example.com',
                        jsonb_build_object('full_name', 'New Two', 'phone', '+919876500011', 'device_id', :'dev1')),
                 'P0001', 'DEVICE_ALREADY_REGISTERED', 'a second sign-up from the same device is refused');
select throws_ok(format('select pg_temp.sign_up(%L, %L, %L)', :'new2', 'new2@example.com',
                        jsonb_build_object('full_name', 'New Two', 'phone', '+919876500004', 'device_id', :'dev2')),
                 'P0001', 'PHONE_ALREADY_REGISTERED', 'a sign-up with a verified number is refused');
select lives_ok(format('select pg_temp.sign_up(%L, %L, %L)', :'new3', 'new3@example.com', '{"full_name": "No Device"}'),
                'a sign-up without a device ID (support tools, seed) is not limited');

-- =========================================================================
-- Verifying a number
-- =========================================================================
update auth.users set phone = '919876500010', phone_confirmed_at = now() where id = :'new1';
select is((select phone from public.profiles where id = :'new1'), '+919876500010', 'the verified number reaches the profile');

-- An unverified copy saved before verification existed gives way to the verified owner.
update public.profiles set phone = '+919876500012' where id = :'new3';
select lives_ok(format('select pg_temp.sign_up(%L, %L, %L)', :'new4', 'new4@example.com', '{"full_name": "New Four"}'),
                'another user signs up');
update auth.users set phone = '919876500012', phone_confirmed_at = now() where id = :'new4';
select is((select phone from public.profiles where id = :'new4'), '+919876500012', 'the verifying user gets the number');
select is((select phone from public.profiles where id = :'new3'), null, 'the unverified copy is cleared');

-- =========================================================================
-- Users cannot write their number directly
-- =========================================================================
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'new3', 'role', 'authenticated')::text, true);
select throws_ok(format('update public.profiles set phone = %L where id = %L', '+919876500013', :'new3'),
                 '42501', null, 'the phone column is not writable by users');
select lives_ok(format('update public.profiles set full_name = %L where id = %L', 'Renamed', :'new3'),
                'the name still is');

-- =========================================================================
-- get_my_phone_status and the verification switch
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'new3', 'role', 'authenticated')::text, true);
select is(public.get_my_phone_status(),
          '{"required": false, "verified": false, "phone": null, "signup_phone": null}'::jsonb, 'unverified user, switch off');
select throws_ok('select public.rate_booking(gen_random_uuid(), 5::smallint)', 'P0001', 'BOOKING_NOT_FOUND',
                 'with the switch off, an unverified passenger can use the app');

reset role;
update public.platform_settings set phone_verification_required = true where id = 1;
set local role authenticated;

select is((public.get_my_phone_status()->>'required')::boolean, true, 'the app is told verification is required');
select throws_ok('select public.rate_booking(gen_random_uuid(), 5::smallint)', 'P0001', 'PHONE_NOT_VERIFIED',
                 'with the switch on, an unverified passenger is refused');
select lives_ok('select public.raise_issue(''ACCOUNT_DELETION'', ''Please delete my account'')',
                'but can still ask support to delete the account');

select set_config('request.jwt.claims', jsonb_build_object('sub', :'new1', 'role', 'authenticated')::text, true);
select is(public.get_my_phone_status(),
          '{"required": true, "verified": true, "phone": "+919876500010", "signup_phone": "+919876500010"}'::jsonb,
          'a verified user');
select throws_ok('select public.rate_booking(gen_random_uuid(), 5::smallint)', 'P0001', 'BOOKING_NOT_FOUND',
                 'a verified passenger gets through');
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select lives_ok('select public.get_my_driver_rating()', 'a verified driver gets through');

select * from finish();
rollback;
