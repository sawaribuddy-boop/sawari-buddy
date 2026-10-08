-- Cash payment collection: complete_trip leaves payment PENDING; the driver marks received / not paid.
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
select throws_ok(format('select public.mark_booking_payment(%L, true)', :'b_priya'), 'P0001', 'INVALID_TRANSITION',
                 'payment cannot be marked before the ride is completed');

select public.final_call(:'trip1'::uuid);
select public.mark_boarded(:'b_priya'::uuid);
select public.mark_boarded(:'b_neha'::uuid);
select public.start_trip(:'trip1'::uuid);
select public.complete_trip(:'trip1'::uuid);

-- =========================================================================
-- After completion: payment pending, nothing in the ledger, next trip blocked
-- =========================================================================
select is((select array_agg(distinct payment_status::text) from public.bookings where trip_id = :'trip1'::uuid),
          array['PENDING'], 'completed bookings wait for payment');
select is((select count(*)::int from public.ledger_transactions where trip_id = :'trip1'::uuid), 0,
          'nothing is posted until the driver marks payment');
select is((public.get_driver_payments_to_collect()->>'pending_count')::int, 2, 'two payments to collect');
select is((select count(*)::int from jsonb_array_elements(public.get_driver_payments_to_collect()->'bookings') e
            where e->>'trip_id' = :'trip1'), 2, 'the collect screen lists both passengers');
select throws_ok(format('select public.open_trip(%L, %L)', :'auto1', :'route1'), 'P0001', 'PAYMENTS_PENDING',
                 'a new trip waits until payments are marked');

-- Only this trip's driver can mark.
select set_config('request.jwt.claims', jsonb_build_object('sub', :'suresh', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.mark_booking_payment(%L, true)', :'b_priya'), 'P0001', 'BOOKING_NOT_FOUND',
                 'another driver cannot mark the payment');
select set_config('request.jwt.claims', jsonb_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.mark_booking_payment(%L, true)', :'b_priya'), 'P0001', 'NOT_AUTHORISED',
                 'a passenger cannot mark their own payment');
select is(public.get_my_booking(:'b_priya'::uuid)->'booking'->>'payment_status', 'PENDING', 'passenger sees payment pending');

-- =========================================================================
-- Received / not paid
-- =========================================================================
select set_config('request.jwt.claims', jsonb_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select is((public.mark_booking_payment(:'b_priya'::uuid, true)).payment_status::text, 'PAID', 'Priya paid cash');
select is((public.mark_booking_payment(:'b_priya'::uuid, true)).payment_status::text, 'PAID', 'marking again is a no-op');
select is((select count(*)::int from public.ledger_transactions where booking_id = :'b_priya'::uuid), 1,
          'the fare is posted once');
select throws_ok(format('select public.mark_booking_payment(%L, false)', :'b_priya'), 'P0001', 'PAYMENT_ALREADY_RECEIVED',
                 'a received payment cannot be changed to not paid');

select is((public.mark_booking_payment(:'b_neha'::uuid, false)).payment_status::text, 'UNPAID', 'Neha did not pay');
select is((select count(*)::int from public.ledger_transactions where booking_id = :'b_neha'::uuid), 0,
          'an unpaid ride posts nothing, so the driver owes no fee for it');
select is((select count(*)::int from jsonb_array_elements(public.get_driver_trip_history()) e
            where e->>'id' = :'trip1' and (e->>'unpaid_count')::int = 1
              and (e->>'fare_paise')::bigint = (select total_fare_paise from public.bookings where id = :'b_priya'::uuid)), 1,
          'trip history counts only collected fares and shows one unpaid');

select lives_ok(format('select public.open_trip(%L, %L)', :'auto1', :'route1'), 'once every payment is marked, a new trip opens');

-- Neha pays later: UNPAID -> PAID posts the fare.
select is((public.mark_booking_payment(:'b_neha'::uuid, true)).payment_status::text, 'PAID', 'a late payment is recorded');
select is((select count(*)::int from public.ledger_transactions where booking_id = :'b_neha'::uuid), 1, 'and posted once');

-- The table guard enforces the same order for any writer.
reset role;
select throws_ok(format('update public.bookings set payment_status = %L where id = %L', 'PENDING', :'b_priya'),
                 'P0001', 'INVALID_TRANSITION', 'payment status cannot go backwards');

select * from finish();
rollback;
