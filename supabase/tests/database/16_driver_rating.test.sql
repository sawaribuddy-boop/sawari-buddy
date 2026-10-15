-- Driver rating: get_my_driver_rating and the rating_received broadcast on the driver's own channel.
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

-- Raj takes Priya and Neha; both are dropped off.
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select is(public.get_my_driver_rating(),
          '{"average": null, "count": 0, "by_stars": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}}'::jsonb,
          'a driver with no ratings yet');
select public.open_trip(:'auto1', :'route1');
select public.driver_heartbeat(28.57, 77.33, 5.0);
select id as trip1 from public.trips where driver_id = :'raj' and status = 'OPEN' \gset

select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select id as b_priya from public.book_seats(:'trip1'::uuid, 1::smallint, gen_random_uuid(), 'ANY') \gset
select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select id as b_neha from public.book_seats(:'trip1'::uuid, 1::smallint, gen_random_uuid(), 'ANY') \gset

select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select public.final_call(:'trip1'::uuid);
select pg_temp.board(:'b_priya'::uuid);
select pg_temp.board(:'b_neha'::uuid);
select public.start_trip(:'trip1'::uuid);
select public.drop_off_passenger(:'b_priya'::uuid, true);
select public.drop_off_passenger(:'b_neha'::uuid, true);
select public.complete_trip(:'trip1'::uuid);

-- Priya gives 5 stars, Neha 4.
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select public.rate_booking(:'b_priya'::uuid, 5::smallint, 'Great');
select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select public.rate_booking(:'b_neha'::uuid, 4::smallint);

-- =========================================================================
-- get_my_driver_rating
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select is(public.get_my_driver_rating(),
          '{"average": 4.5, "count": 2, "by_stars": {"1": 0, "2": 0, "3": 0, "4": 1, "5": 1}}'::jsonb,
          'Raj sees his average, count and stars breakdown');
select ok(public.get_my_driver_rating()::text !~* 'great|priya|neha', 'no comments or passenger names');

select set_config('request.jwt.claims', jsonb_build_object('sub', :'suresh', 'role', 'authenticated')::text, true);
select is((public.get_my_driver_rating()->>'count')::int, 0, 'another driver sees only their own ratings');
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select throws_ok('select public.get_my_driver_rating()', 'P0001', 'NOT_AUTHORISED', 'passengers cannot call it');

-- =========================================================================
-- Broadcast on the driver's own channel
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select ok(private.can_join_driver_channel('driver:' || :'raj'), 'Raj can join his own channel');
select ok(not private.can_join_driver_channel('driver:' || :'suresh'), 'but not another driver''s');
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select ok(not private.can_join_driver_channel('driver:' || :'raj'), 'a passenger cannot join a driver''s channel');

reset role;
select is((select array_agg(payload - 'id' order by (payload->>'count')::int) from realtime.messages
            where topic = 'driver:' || :'raj' and event = 'rating_received'),
          array['{"stars": 5, "average": 5.0, "count": 1}'::jsonb, '{"stars": 4, "average": 4.5, "count": 2}'::jsonb],
          'each new rating is broadcast to the driver with the new average');

select * from finish();
rollback;
