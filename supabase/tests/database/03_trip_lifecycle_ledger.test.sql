-- Trip lifecycle guards, completion, ledger postings, earnings, snapshots.
begin;
create extension if not exists pgtap with schema extensions;
grant execute on all functions in schema extensions to authenticated, anon;
select no_plan();

\set admin  '00000000-0000-4000-a000-000000000001'
\set raj    '00000000-0000-4000-a000-000000000011'
\set suresh '00000000-0000-4000-a000-000000000012'
\set priya  '00000000-0000-4000-a000-000000000021'
\set neha   '00000000-0000-4000-a000-000000000022'
\set auto   '00000000-0000-4000-b000-000000000102'
\set route  '00000000-0000-4000-d000-000000000001'

set local role authenticated;

-- ---------------- open_trip guards ----------------
select set_config('request.jwt.claims', json_build_object('sub', :'suresh', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.open_trip(%L, %L)', :'auto', :'route'), 'P0001', 'AUTO_NOT_ASSIGNED',
                 'driver cannot use an auto not assigned to them');

select set_config('request.jwt.claims', json_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select id as trip_id from public.open_trip(:'auto', :'route') \gset
select throws_ok(format('select public.open_trip(%L, %L)', :'auto', :'route'), 'P0001', 'ACTIVE_TRIP_EXISTS',
                 'one active trip per driver');
select throws_ok(format('select public.start_trip(%L)', :'trip_id'), 'P0001', 'NO_PASSENGERS_BOARDED',
                 'cannot start an empty trip');

-- ---------------- snapshots ----------------
select set_config('request.jwt.claims', json_build_object('sub', :'priya', 'role', 'authenticated')::text, true);
select id as b_priya from public.book_seats(:'trip_id', 1::smallint, 'aaaaaaaa-0000-4000-8000-00000000b001') \gset

reset role;
update public.autos set capacity = 3 where id = :'auto';
update public.routes set fare_paise = 9900 where id = :'route';
update public.platform_settings set commission_bps = 5000 where id = 1;
select is((select capacity::int from public.trips where id = :'trip_id'), 5, 'auto capacity change does not affect the open trip');
select is((select fare_paise from public.trips where id = :'trip_id'), 3000::bigint, 'route fare change does not affect the open trip');
select is((select platform_fee_paise from public.bookings where id = :'b_priya'), 300::bigint,
          'commission change does not affect an existing booking');
select throws_ok(format('update public.trips set capacity = 8 where id = %L', :'trip_id'), 'P0001', 'IMMUTABLE_FIELD',
                 'trip snapshots are immutable');
select throws_ok(format('update public.trips set status = %L, completed_at = now() where id = %L', 'COMPLETED', :'trip_id'),
                 'P0001', 'INVALID_TRANSITION', 'trip cannot jump OPEN -> COMPLETED');
update public.platform_settings set commission_bps = 1000 where id = 1;

-- ---------------- run the trip ----------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select id as w1 from public.add_walk_in(:'trip_id', 2::smallint, 'cccccccc-0000-4000-8000-00000000b001') \gset
select is((select platform_fee_paise from public.bookings where id = :'w1'), 0::bigint, 'walk-in commission defaults to 0');
select lives_ok(format('select public.mark_boarded(%L)', :'b_priya'), 'board app passenger');
select is((select status::text from public.start_trip(:'trip_id')), 'IN_PROGRESS', 'trip in progress');
select throws_ok(format('select public.cancel_trip(%L)', :'trip_id'), 'P0001', 'INVALID_TRANSITION',
                 'driver cannot cancel an in-progress trip');
select is((select status::text from public.complete_trip(:'trip_id')), 'COMPLETED', 'trip completed');
select is((select array_agg(distinct status::text) from public.bookings where trip_id = :'trip_id'), array['COMPLETED'],
          'boarded passengers become COMPLETED');
select is((select status::text from public.complete_trip(:'trip_id')), 'COMPLETED', 'complete_trip is idempotent');
select is((select active_trip_id from public.driver_presence where driver_id = :'raj'), null, 'presence cleared after completion');

-- Earnings (driver's own view): app 1 x 3000 (fee 300) + walk-in 2 x 3000 (fee 0)
select is((public.driver_earnings_summary() ->> 'earnings_paise')::bigint, 8700::bigint, 'driver earnings = 2700 + 6000');
select is((public.driver_earnings_summary() ->> 'fares_collected_paise')::bigint, 9000::bigint, 'cash fares collected = 9000');
select is((public.driver_earnings_summary() ->> 'settlement_balance_paise')::bigint, -300::bigint,
          'cash model: driver owes the platform its 300 fee');
select is((public.driver_earnings_summary() ->> 'completed_trips')::int, 1, 'completed trip counted');
select throws_ok(format('select public.driver_earnings_summary(null, null, %L)', :'suresh'), 'P0001', 'NOT_AUTHORISED',
                 'driver cannot read another driver''s earnings');

-- Ledger checks as superuser
reset role;
select is((select count(*)::int from public.ledger_transactions where trip_id = :'trip_id'), 2,
          'one ledger transaction per completed booking, none duplicated by the retry');
select is((select count(*)::int from (select transaction_id from public.ledger_entries group by transaction_id having sum(amount_paise) <> 0) x),
          0, 'every ledger transaction sums to zero');
select is((select balance_paise from public.ledger_account_balances where type = 'PLATFORM_REVENUE'), 300::bigint,
          'platform revenue = 300');
select is((select array_agg(entry_type::text || ':' || amount_paise order by amount_paise)
             from public.ledger_entries e join public.ledger_transactions t on t.id = e.transaction_id
            where t.booking_id = :'b_priya'),
          array['PAYMENT:-3000', 'PLATFORM_FEE:300', 'DRIVER_EARNING:2700'], 'app fare posting lines');

-- Admin sees any driver's earnings
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin', 'role', 'authenticated')::text, true);
select is((public.driver_earnings_summary(null, null, :'raj') ->> 'earnings_paise')::bigint, 8700::bigint,
          'admin reads driver earnings');

-- ---------------- cancellation of a trip with bookings ----------------
select set_config('request.jwt.claims', json_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select id as trip2 from public.open_trip(:'auto', :'route') \gset
select set_config('request.jwt.claims', json_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select id as b_neha from public.book_seats(:'trip2', 1::smallint, 'bbbbbbbb-0000-4000-8000-00000000b001') \gset
select set_config('request.jwt.claims', json_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select is((select cancel_reason::text from public.cancel_trip(:'trip2')), 'DRIVER_CANCELLED', 'driver cancels an open trip');
select is((select status::text || '/' || cancel_reason::text from public.bookings where id = :'b_neha'),
          'CANCELLED/TRIP_CANCELLED', 'bookings are cancelled with the trip');
select is((select count(*)::int from public.ledger_transactions where trip_id = :'trip2'), 0,
          'cancelled trip posts nothing to the ledger (cash, nothing collected)');

-- Suspended driver account cannot open trips
reset role;
update public.drivers set status = 'SUSPENDED' where id = :'raj';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'raj', 'role', 'authenticated')::text, true);
select throws_ok(format('select public.open_trip(%L, %L)', :'auto', :'route'), 'P0001', 'DRIVER_NOT_ACTIVE',
                 'suspended driver cannot go online');

-- Fee rounding (half up, integer paise)
reset role;
select is(private.platform_fee(3333, 1000), 333::bigint, 'fee 333.3 rounds to 333');
select is(private.platform_fee(3335, 1000), 334::bigint, 'fee 333.5 rounds to 334');

select * from finish();
rollback;
