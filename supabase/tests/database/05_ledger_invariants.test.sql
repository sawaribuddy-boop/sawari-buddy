-- Ledger invariants: zero-sum, append-only, idempotent postings, owner-only visibility.
begin;
create extension if not exists pgtap with schema extensions;
grant execute on all functions in schema extensions to authenticated, anon;
select no_plan();

\set raj    '00000000-0000-4000-a000-000000000011'
\set suresh '00000000-0000-4000-a000-000000000012'

select private.ledger_account('DRIVER_SETTLEMENT', :'raj') as acct_raj \gset
select private.ledger_account('PLATFORM_REVENUE') as acct_platform \gset
select is(private.ledger_account('DRIVER_SETTLEMENT', :'raj'), :'acct_raj'::uuid, 'account lookup is get-or-create (no duplicates)');
select is(private.ledger_account('PLATFORM_REVENUE'), :'acct_platform'::uuid, 'platform account is a singleton');

-- Balanced posting
select private.ledger_post('ADJUSTMENT', 'test:adj:1', 'Test adjustment',
  jsonb_build_array(jsonb_build_object('account_id', :'acct_raj', 'entry_type', 'ADJUSTMENT', 'amount_paise', 500),
                    jsonb_build_object('account_id', :'acct_platform', 'entry_type', 'ADJUSTMENT', 'amount_paise', -500))) as tx1 \gset
select lives_ok('set constraints all immediate', 'balanced transaction passes the zero-sum check');
set constraints all deferred;

-- Idempotent
select is(private.ledger_post('ADJUSTMENT', 'test:adj:1', 'Duplicate',
  jsonb_build_array(jsonb_build_object('account_id', :'acct_raj', 'entry_type', 'ADJUSTMENT', 'amount_paise', 999),
                    jsonb_build_object('account_id', :'acct_platform', 'entry_type', 'ADJUSTMENT', 'amount_paise', -999))),
  :'tx1'::uuid, 'same idempotency key returns the original transaction');
select is((select count(*)::int from public.ledger_entries where transaction_id = :'tx1'), 2, 'duplicate posting added no lines');

-- Append-only
select throws_ok(format('update public.ledger_entries set amount_paise = 1 where transaction_id = %L', :'tx1'),
                 'P0001', 'LEDGER_IMMUTABLE', 'ledger entries cannot be updated');
select throws_ok(format('delete from public.ledger_entries where transaction_id = %L', :'tx1'),
                 'P0001', 'LEDGER_IMMUTABLE', 'ledger entries cannot be deleted');
select throws_ok(format('delete from public.ledger_transactions where id = %L', :'tx1'),
                 'P0001', 'LEDGER_IMMUTABLE', 'ledger transactions cannot be deleted');
select throws_ok('truncate public.ledger_entries', 'P0001', 'LEDGER_IMMUTABLE', 'ledger cannot be truncated');

-- Unbalanced posting fails the deferred check
select private.ledger_post('ADJUSTMENT', 'test:adj:bad', 'Unbalanced',
  jsonb_build_array(jsonb_build_object('account_id', :'acct_raj', 'entry_type', 'ADJUSTMENT', 'amount_paise', 100),
                    jsonb_build_object('account_id', :'acct_platform', 'entry_type', 'ADJUSTMENT', 'amount_paise', -99))) as tx_bad \gset
select throws_ok('set constraints all immediate', 'P0001', 'LEDGER_UNBALANCED', 'unbalanced transaction is rejected at commit');

select * from finish();
rollback;
