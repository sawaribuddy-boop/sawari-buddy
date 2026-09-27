-- The deferred constraint triggers on ledger_entries and ledger_transactions fire at
-- commit time, outside the SECURITY DEFINER context of complete_trip.
--
-- Two issues:
-- 1. The authenticated role lacked EXECUTE on these private functions.
-- 2. ledger_assert_balanced selects from ledger_entries, but RLS hides entries for
--    accounts the caller doesn't own (e.g. PLATFORM_REVENUE), causing a false
--    LEDGER_UNBALANCED error. Making it SECURITY DEFINER lets it see all entries.

create or replace function private.ledger_assert_balanced(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sum bigint;
  v_count integer;
begin
  select coalesce(sum(amount_paise), 0), count(*) into v_sum, v_count
    from public.ledger_entries where transaction_id = p_transaction_id;
  if v_count < 2 or v_sum <> 0 then
    perform private.raise_error('LEDGER_UNBALANCED',
      format('Ledger transaction %s has %s entries summing to %s', p_transaction_id, v_count, v_sum));
  end if;
end;
$$;

grant execute on function
  private.ledger_assert_balanced(uuid),
  private.ledger_entries_check_balanced(),
  private.ledger_transactions_check_balanced(),
  private.raise_error(text, text)
to authenticated;
