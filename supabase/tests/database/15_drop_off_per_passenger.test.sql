-- Drop off each passenger on their own with cash received / not paid; End trip only once nobody is on board.
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

-- Test helper: the driver boards a passenger by entering the PIN shown in the passenger's app.
create function pg_temp.board(p_booking uuid) returns text language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  r := public.board_with_pin((select trip_id from public.bookings where id = p_booking),
                             (select pin from public.booking_pins where booking_id = p_booking));
  if not coalesce((r->>'ok')::boolean, false) then raise exception 'boarding failed: %', r; end if;
  return 'BOARDED';
end $$;
grant execute on function pg_temp.board(uuid) to authenticated;

set local role authenticated;

-- Raj runs a trip with Priya (1 seat) and Neha (2 seats).
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select public.open_trip(:'auto1', :'route1');
select public.driver_heartbeat(28.57, 77.33, 5.0);
select id as trip1 from public.trips where driver_id = :'raj' and status = 'OPEN' \gset

select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select id as b_priya from public.book_seats(:'trip1'::uuid, 1::smallint, gen_random_uuid(), 'ANY') \gset
select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select id as b_neha from public.book_seats(:'trip1'::uuid, 2::smallint, gen_random_uuid(), 'ANY') \gset

select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select public.final_call(:'trip1'::uuid);
select pg_temp.board(:'b_priya'::uuid);
select pg_temp.board(:'b_neha'::uuid);

-- =========================================================================
-- Before the trip starts
-- =========================================================================
select throws_ok(format('select public.drop_off_passenger(%L, true)', :'b_priya'), 'P0001', 'INVALID_TRANSITION',
                 'passengers cannot be dropped off before the trip starts');
select public.start_trip(:'trip1'::uuid);

-- =========================================================================
-- Who may drop off
-- =========================================================================
select throws_ok(format('select public.drop_off_passenger(%L, null)', :'b_priya'), 'P0001', 'INVALID_TRANSITION',
                 'the driver must say whether the cash was received');
select set_config('request.jwt.claims', jsonb_build_object('sub', :'suresh', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.drop_off_passenger(%L, true)', :'b_priya'), 'P0001', 'BOOKING_NOT_FOUND',
                 'another driver cannot drop off this passenger');
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.drop_off_passenger(%L, true)', :'b_priya'), 'P0001', 'NOT_AUTHORISED',
                 'a passenger cannot drop themselves off');

-- =========================================================================
-- Priya gets off and pays
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select is((public.drop_off_passenger(:'b_priya'::uuid, true)).payment_status::text, 'PAID', 'Priya dropped off, cash received');
select is((select status::text from public.bookings where id = :'b_priya'::uuid), 'COMPLETED', 'her booking is completed');
select is((select count(*)::int from public.ledger_transactions where booking_id = :'b_priya'::uuid), 1, 'her fare is posted');
select is((public.drop_off_passenger(:'b_priya'::uuid, true)).payment_status::text, 'PAID', 'dropping off again is a no-op');
select is((select count(*)::int from public.ledger_transactions where booking_id = :'b_priya'::uuid), 1, 'and posts nothing more');
select throws_ok(format('select public.drop_off_passenger(%L, false)', :'b_priya'), 'P0001', 'PAYMENT_ALREADY_RECEIVED',
                 'a received payment cannot be changed to not paid');

select is((select status::text from public.trips where id = :'trip1'::uuid), 'IN_PROGRESS', 'the trip goes on');
select is((select e->>'payment_status' from jsonb_array_elements(public.get_driver_home()->'active_trip'->'bookings') e
            where e->>'id' = :'b_priya'), 'PAID', 'the driver still sees Priya on the trip, marked paid');
select is((select e->>'status' from jsonb_array_elements(public.get_driver_home()->'active_trip'->'bookings') e
            where e->>'id' = :'b_neha'), 'BOARDED', 'and Neha still on board');
select throws_ok(format('select public.complete_trip(%L)', :'trip1'), 'P0001', 'PASSENGERS_ON_BOARD',
                 'End trip waits until the last passenger is dropped off');

-- =========================================================================
-- Neha gets off without paying, then pays
-- =========================================================================
select is((public.drop_off_passenger(:'b_neha'::uuid, false)).payment_status::text, 'UNPAID', 'Neha dropped off, not paid');
select is((select count(*)::int from public.ledger_transactions where booking_id = :'b_neha'::uuid), 0,
          'an unpaid ride posts nothing');
select is((public.drop_off_passenger(:'b_neha'::uuid, true)).payment_status::text, 'PAID', 'she pays before the driver leaves');
select is((select count(*)::int from public.ledger_transactions where booking_id = :'b_neha'::uuid), 1, 'her fare is posted once');

-- =========================================================================
-- End trip
-- =========================================================================
select is((public.complete_trip(:'trip1'::uuid)).status::text, 'COMPLETED', 'with nobody on board the trip ends');
select is((select array_agg(distinct payment_status::text) from public.bookings where trip_id = :'trip1'::uuid),
          array['PAID'], 'ending the trip leaves the recorded payments alone');
select is((public.get_driver_payments_to_collect()->>'pending_count')::int, 0, 'nothing left to collect');
select lives_ok(format('select public.open_trip(%L, %L)', :'auto1', :'route1'), 'the next trip opens straight away');

select * from finish();
rollback;
