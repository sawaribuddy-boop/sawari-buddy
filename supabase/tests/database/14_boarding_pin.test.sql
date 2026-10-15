-- Boarding PIN: assigned per app booking, visible only to the passenger, required to board,
-- 5 wrong PINs per minute.
begin;
create extension if not exists pgtap with schema extensions;
grant execute on all functions in schema extensions to authenticated, anon;
select no_plan();

\set raj    '00000000-0000-4000-a000-000000000011'
\set suresh '00000000-0000-4000-a000-000000000012'
\set priya  '00000000-0000-4000-a000-000000000021'
\set neha   '00000000-0000-4000-a000-000000000022'
\set auto1  '00000000-0000-4000-b000-000000000102'
\set route1 '00000000-0000-4000-d000-000000000001'

set local role authenticated;

select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select id as trip1 from public.open_trip(:'auto1', :'route1') \gset
select public.driver_heartbeat(28.57, 77.33, 5.0);
select id as walk_in from public.add_walk_in(:'trip1', 1::smallint, gen_random_uuid()) \gset

select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select id as b_priya from public.book_seats(:'trip1', 1::smallint, gen_random_uuid(), 'ANY') \gset
select public.get_my_booking(:'b_priya')->>'boarding_pin' as priya_pin \gset
select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select id as b_neha from public.book_seats(:'trip1', 2::smallint, gen_random_uuid(), 'ANY') \gset
select public.get_my_active_booking()->>'boarding_pin' as neha_pin \gset

-- =========================================================================
-- Assignment and visibility
-- =========================================================================
select matches(:'priya_pin'::text, '^[0-9]{4}$', 'the passenger sees a 4-digit PIN on their booking');
select matches(:'neha_pin'::text, '^[0-9]{4}$', 'the PIN is on the active booking too');
select isnt(:'priya_pin'::text, :'neha_pin'::text, 'PINs on the same trip are different');
select is((select count(*)::int from public.booking_pins), 1, 'a passenger can read only their own PIN');

select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.booking_pins), 0, 'the driver cannot read any PIN');

reset role;
select is((select count(*)::int from public.booking_pins where booking_id = :'walk_in'), 0, 'walk-ins have no PIN');
set local role authenticated;

-- =========================================================================
-- Boarding needs the PIN
-- =========================================================================
select throws_ok(format('select public.mark_boarded(%L)', :'b_priya'), 'P0001', 'PIN_REQUIRED',
                 'an app passenger cannot be boarded without their PIN');
select throws_ok(format('select public.board_with_pin(%L, %L)', :'trip1', '12a4'), 'P0001', 'PIN_INVALID',
                 'the PIN must be 4 digits');

select set_config('request.jwt.claims', jsonb_build_object('sub', :'suresh', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.board_with_pin(%L, %L)', :'trip1', :'priya_pin'), 'P0001', 'TRIP_NOT_FOUND',
                 'another driver cannot use a PIN on this trip');

select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select is(public.board_with_pin(:'trip1', :'priya_pin')->>'booking_id', :'b_priya', 'the PIN boards the passenger it belongs to');
select is((select status::text from public.bookings where id = :'b_priya'), 'BOARDED', 'Priya is on board');
select is((select status::text from public.bookings where id = :'b_neha'), 'CONFIRMED', 'Neha is not');
select is((public.board_with_pin(:'trip1', :'priya_pin')->>'already_boarded')::boolean, true, 'entering it again is harmless');

-- =========================================================================
-- Wrong PINs: 5 per minute, then locked (even for the right PIN)
-- =========================================================================
select '0000' as wrong \gset
select case when :'wrong' in (:'priya_pin', :'neha_pin') then '9999' else '0000' end as wrong \gset
select is((public.board_with_pin(:'trip1', :'wrong')->>'attempts_left')::int, 4, 'a wrong PIN leaves 4 tries');
select public.board_with_pin(:'trip1', :'wrong');
select public.board_with_pin(:'trip1', :'wrong');
select public.board_with_pin(:'trip1', :'wrong');
select is(public.board_with_pin(:'trip1', :'wrong')->>'attempts_left', '0', 'the fifth wrong PIN leaves none');
select is(public.board_with_pin(:'trip1', :'neha_pin')->>'reason', 'LOCKED', 'then even the right PIN waits');
select is((select status::text from public.bookings where id = :'b_neha'), 'CONFIRMED', 'nobody was boarded while locked');

-- A minute later the driver can try again.
reset role;
update private.pin_attempts set attempted_at = attempted_at - interval '61 seconds';
set local role authenticated;
select is((public.board_with_pin(:'trip1', :'neha_pin')->>'ok')::boolean, true, 'after a minute the right PIN works');
select is((select status::text from public.bookings where id = :'b_neha'), 'BOARDED', 'Neha is on board');

select * from finish();
rollback;
