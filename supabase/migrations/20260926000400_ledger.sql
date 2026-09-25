-- SawariBuddy: append-only double-entry ledger.
--
-- * No mutable balances anywhere. Balance of an account = sum of its entries.
-- * Every transaction's entries sum to zero (deferred constraint trigger).
-- * Rows can never be updated or deleted; mistakes are corrected with new ADJUSTMENT transactions.
-- * Every transaction has a unique idempotency key, so a retried posting can't double count.
--
-- Sign convention: positive amount = value credited to the account holder (platform owes them);
-- negative = holder owes the platform / value leaves the holder. Platform accounts take the mirror side.
--
-- V1 (cash only) produces PAYMENT, DRIVER_EARNING and PLATFORM_FEE lines at trip completion.
-- BOOKING_DEBIT, REFUND_CREDIT, SETTLEMENT and PAYMENT_CLEARING exist for later prepaid/digital flows.

create table public.ledger_accounts (
  id                uuid primary key default gen_random_uuid(),
  type              public.ledger_account_type not null,
  owner_profile_id  uuid references public.profiles (id),
  created_at        timestamptz not null default now(),
  constraint ledger_accounts_owner_matches_type check (
    (type in ('PASSENGER_CREDIT', 'DRIVER_SETTLEMENT')) = (owner_profile_id is not null)
  ),
  constraint ledger_accounts_uniq unique nulls not distinct (type, owner_profile_id)
);
create index ledger_accounts_owner_idx on public.ledger_accounts (owner_profile_id) where owner_profile_id is not null;

create table public.ledger_transactions (
  id                       uuid primary key default gen_random_uuid(),
  type                     public.ledger_entry_type not null,  -- primary classification of the business event
  idempotency_key          text not null unique check (char_length(idempotency_key) between 1 and 200),
  booking_id               uuid references public.bookings (id),
  trip_id                  uuid references public.trips (id),
  reverses_transaction_id  uuid references public.ledger_transactions (id),
  description              text not null,
  created_by               uuid references public.profiles (id),  -- null = system
  created_at               timestamptz not null default now()
);
create index ledger_transactions_booking_idx on public.ledger_transactions (booking_id) where booking_id is not null;
create index ledger_transactions_trip_idx on public.ledger_transactions (trip_id) where trip_id is not null;
create index ledger_transactions_reverses_idx on public.ledger_transactions (reverses_transaction_id) where reverses_transaction_id is not null;

create table public.ledger_entries (
  id              bigint generated always as identity primary key,
  transaction_id  uuid not null references public.ledger_transactions (id),
  account_id      uuid not null references public.ledger_accounts (id),
  entry_type      public.ledger_entry_type not null,
  amount_paise    bigint not null check (amount_paise <> 0),
  created_at      timestamptz not null default now()
);
create index ledger_entries_transaction_idx on public.ledger_entries (transaction_id);
create index ledger_entries_account_idx on public.ledger_entries (account_id, created_at);

-- Append-only: block UPDATE / DELETE / TRUNCATE for every role.
create function private.ledger_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.raise_error('LEDGER_IMMUTABLE', 'Ledger rows cannot be modified; post an ADJUSTMENT instead');
  return null;
end;
$$;
create trigger ledger_accounts_immutable before update or delete on public.ledger_accounts
  for each row execute function private.ledger_immutable();
create trigger ledger_transactions_immutable before update or delete on public.ledger_transactions
  for each row execute function private.ledger_immutable();
create trigger ledger_entries_immutable before update or delete on public.ledger_entries
  for each row execute function private.ledger_immutable();
create trigger ledger_transactions_no_truncate before truncate on public.ledger_transactions
  for each statement execute function private.ledger_immutable();
create trigger ledger_entries_no_truncate before truncate on public.ledger_entries
  for each statement execute function private.ledger_immutable();

-- Zero-sum and at-least-two-lines, checked at commit (entries are inserted one by one).
create function private.ledger_assert_balanced(p_transaction_id uuid)
returns void
language plpgsql
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

create function private.ledger_entries_check_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.ledger_assert_balanced(new.transaction_id);
  return null;
end;
$$;

create function private.ledger_transactions_check_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.ledger_assert_balanced(new.id);
  return null;
end;
$$;

create constraint trigger ledger_entries_balanced after insert on public.ledger_entries
  deferrable initially deferred for each row execute function private.ledger_entries_check_balanced();
create constraint trigger ledger_transactions_balanced after insert on public.ledger_transactions
  deferrable initially deferred for each row execute function private.ledger_transactions_check_balanced();

-- Get (or lazily create) an account.
create function private.ledger_account(p_type public.ledger_account_type, p_owner uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.ledger_accounts
   where type = p_type and owner_profile_id is not distinct from p_owner;
  if v_id is null then
    insert into public.ledger_accounts (type, owner_profile_id) values (p_type, p_owner)
    on conflict (type, owner_profile_id) do nothing
    returning id into v_id;
    if v_id is null then  -- created concurrently
      select id into v_id from public.ledger_accounts
       where type = p_type and owner_profile_id is not distinct from p_owner;
    end if;
  end if;
  return v_id;
end;
$$;

-- Post one transaction. p_entries: [{"account_id": uuid, "entry_type": text, "amount_paise": int}, ...]
-- Zero-amount lines are skipped. Idempotent: an existing key returns the existing transaction id.
create function private.ledger_post(
  p_type             public.ledger_entry_type,
  p_idempotency_key  text,
  p_description      text,
  p_entries          jsonb,
  p_booking_id       uuid default null,
  p_trip_id          uuid default null,
  p_created_by       uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx uuid;
begin
  insert into public.ledger_transactions (type, idempotency_key, description, booking_id, trip_id, created_by)
  values (p_type, p_idempotency_key, p_description, p_booking_id, p_trip_id, p_created_by)
  on conflict (idempotency_key) do nothing
  returning id into v_tx;

  if v_tx is null then
    select id into v_tx from public.ledger_transactions where idempotency_key = p_idempotency_key;
    return v_tx;
  end if;

  insert into public.ledger_entries (transaction_id, account_id, entry_type, amount_paise)
  select v_tx, (e ->> 'account_id')::uuid, (e ->> 'entry_type')::public.ledger_entry_type, (e ->> 'amount_paise')::bigint
    from jsonb_array_elements(p_entries) e
   where (e ->> 'amount_paise')::bigint <> 0;
  return v_tx;
end;
$$;

-- Fare split. Integer paise, fee rounded half-up. Mirrored (for display only) in packages/domain.
create function private.platform_fee(p_total_paise bigint, p_bps integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select (p_total_paise * p_bps + 5000) / 10000;
$$;

-- Post the cash fare for one COMPLETED booking. With cash, the driver already holds the fare:
--   DRIVER_SETTLEMENT(driver)  PAYMENT         -total    (cash collected by driver)
--   DRIVER_SETTLEMENT(driver)  DRIVER_EARNING  +earning
--   PLATFORM_REVENUE           PLATFORM_FEE    +fee
-- Net driver settlement change = -fee (driver owes the platform its fee).
create function private.ledger_post_booking_fare(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings;
  v_driver uuid;
  v_driver_acct uuid;
begin
  select * into v_b from public.bookings where id = p_booking_id;
  if v_b.status <> 'COMPLETED' then
    perform private.raise_error('INVALID_TRANSITION', 'Only completed bookings are posted to the ledger');
  end if;
  select t.driver_id into v_driver from public.trips t where t.id = v_b.trip_id;
  v_driver_acct := private.ledger_account('DRIVER_SETTLEMENT', v_driver);

  return private.ledger_post(
    'DRIVER_EARNING',
    'booking_fare:' || v_b.id,
    format('%s fare %s (%s)', v_b.source, v_b.code, v_b.payment_method),
    jsonb_build_array(
      jsonb_build_object('account_id', v_driver_acct, 'entry_type', 'PAYMENT', 'amount_paise', -v_b.total_fare_paise),
      jsonb_build_object('account_id', v_driver_acct, 'entry_type', 'DRIVER_EARNING', 'amount_paise', v_b.total_fare_paise - v_b.platform_fee_paise),
      jsonb_build_object('account_id', private.ledger_account('PLATFORM_REVENUE'), 'entry_type', 'PLATFORM_FEE', 'amount_paise', v_b.platform_fee_paise)
    ),
    v_b.id,
    v_b.trip_id,
    null
  );
end;
$$;

-- Balances, derived. security_invoker => callers only see accounts RLS lets them see.
create view public.ledger_account_balances
with (security_invoker = true) as
select a.id as account_id,
       a.type,
       a.owner_profile_id,
       coalesce(sum(e.amount_paise), 0)::bigint as balance_paise,
       count(e.id)::integer as entry_count
  from public.ledger_accounts a
  left join public.ledger_entries e on e.account_id = a.id
 group by a.id;
