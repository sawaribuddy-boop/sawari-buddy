-- Phase 3 Step 6: settlement and adjustment RPCs (admin-only)

-- record_settlement: admin records a cash settlement paid to a driver
-- Debits the driver's DRIVER_SETTLEMENT account, credits PLATFORM_CASH
create function public.record_settlement(
  p_driver_id    uuid,
  p_amount_paise bigint,
  p_description  text default 'Cash settlement'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_role('ADMIN');
  v_driver_acct uuid;
  v_cash_acct   uuid;
begin
  if p_amount_paise <= 0 then
    perform private.raise_error('INVALID_AMOUNT', 'Settlement amount must be positive');
  end if;

  if not exists (select 1 from public.drivers where id = p_driver_id) then
    perform private.raise_error('DRIVER_NOT_FOUND');
  end if;

  v_driver_acct := private.ledger_account('DRIVER_SETTLEMENT', p_driver_id);
  v_cash_acct   := private.ledger_account('PLATFORM_CASH');

  return private.ledger_post(
    'SETTLEMENT',
    'settlement:' || p_driver_id || ':' || extract(epoch from now())::bigint,
    p_description,
    jsonb_build_array(
      jsonb_build_object('account_id', v_driver_acct, 'entry_type', 'SETTLEMENT', 'amount_paise', -p_amount_paise),
      jsonb_build_object('account_id', v_cash_acct,   'entry_type', 'SETTLEMENT', 'amount_paise',  p_amount_paise)
    ),
    null,
    null,
    v_admin
  );
end;
$$;

-- record_adjustment: admin records an adjustment (positive = credit to driver, negative = debit)
create function public.record_adjustment(
  p_driver_id    uuid,
  p_amount_paise bigint,
  p_description  text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_role('ADMIN');
  v_driver_acct uuid;
  v_revenue_acct uuid;
begin
  if p_amount_paise = 0 then
    perform private.raise_error('INVALID_AMOUNT', 'Adjustment amount must be non-zero');
  end if;
  if p_description is null or char_length(trim(p_description)) = 0 then
    perform private.raise_error('DESCRIPTION_REQUIRED', 'Description is required for adjustments');
  end if;

  if not exists (select 1 from public.drivers where id = p_driver_id) then
    perform private.raise_error('DRIVER_NOT_FOUND');
  end if;

  v_driver_acct  := private.ledger_account('DRIVER_SETTLEMENT', p_driver_id);
  v_revenue_acct := private.ledger_account('PLATFORM_REVENUE');

  return private.ledger_post(
    'ADJUSTMENT',
    'adjustment:' || p_driver_id || ':' || extract(epoch from now())::bigint,
    trim(p_description),
    jsonb_build_array(
      jsonb_build_object('account_id', v_driver_acct,  'entry_type', 'ADJUSTMENT', 'amount_paise',  p_amount_paise),
      jsonb_build_object('account_id', v_revenue_acct, 'entry_type', 'ADJUSTMENT', 'amount_paise', -p_amount_paise)
    ),
    null,
    null,
    v_admin
  );
end;
$$;

grant execute on function public.record_settlement(uuid, bigint, text) to authenticated;
grant execute on function public.record_adjustment(uuid, bigint, text) to authenticated;
