-- SawariBuddy: schemas and enum types.
--
-- `public`  : tables + RPCs exposed through the Supabase API (PostgREST).
-- `private` : internal helpers (RLS checks, ledger posting, sweeps). Not exposed by the API.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Functions are NOT executable by default; each RPC is granted explicitly (see the grants migration).
-- The PUBLIC default is global in Postgres, so it has to be revoked without `in schema`.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

create type public.user_role as enum ('PASSENGER', 'DRIVER', 'ADMIN');
create type public.account_status as enum ('ACTIVE', 'SUSPENDED');
create type public.driver_status as enum ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED');
create type public.auto_status as enum ('ACTIVE', 'INACTIVE');

create type public.trip_status as enum (
  'OPEN',         -- accepting app bookings and walk-ins
  'BOARDING',     -- final call made: walk-ins only, no-show timer running
  'IN_PROGRESS',  -- departed
  'COMPLETED',
  'CANCELLED',
  'SUSPENDED'     -- driver unreachable beyond the intervention threshold, awaiting driver/admin
);
create type public.trip_cancel_reason as enum (
  'DRIVER_CANCELLED', 'DRIVER_OFFLINE', 'DRIVER_UNREACHABLE', 'ADMIN_CANCELLED'
);

create type public.booking_source as enum ('APP', 'WALK_IN');
-- Lifecycle: CONFIRMED -> BOARDED -> COMPLETED; CONFIRMED -> CANCELLED | NO_SHOW.
-- A passenger waiting to board stays CONFIRMED. (A future prepaid flow may add a PENDING value.)
create type public.booking_status as enum ('CONFIRMED', 'BOARDED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
create type public.booking_cancel_reason as enum (
  'PASSENGER_CANCELLED', 'TRIP_CANCELLED', 'DRIVER_UNREACHABLE', 'WALK_IN_REMOVED', 'ADMIN_CANCELLED'
);
create type public.seat_preference as enum ('ANY', 'BACK', 'FRONT');
create type public.payment_method as enum ('CASH');

create type public.ledger_account_type as enum (
  'PASSENGER_CREDIT',   -- future: platform credit owed to a passenger (refund credits)
  'DRIVER_SETTLEMENT',  -- per driver: positive = platform owes driver, negative = driver owes platform
  'PLATFORM_REVENUE',   -- platform fees earned
  'PLATFORM_CASH',      -- cash/bank movements recorded by admin (settlements)
  'PAYMENT_CLEARING'    -- future: money received from a payment provider, not yet allocated
);
create type public.ledger_entry_type as enum (
  'PAYMENT', 'BOOKING_DEBIT', 'REFUND_CREDIT', 'ADJUSTMENT', 'DRIVER_EARNING', 'PLATFORM_FEE', 'SETTLEMENT'
);

create type public.issue_source as enum ('PASSENGER', 'DRIVER', 'SYSTEM');
create type public.issue_kind as enum (
  'DRIVER_UNREACHABLE', 'TRIP_STUCK', 'BOOKING_ISSUE', 'DRIVER_BEHAVIOUR', 'PAYMENT', 'OTHER'
);
create type public.issue_status as enum ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

-- Shared trigger: maintain updated_at.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Raise a business error with a stable machine-readable code in MESSAGE
-- (clients map `error.message` to text) and a human explanation in DETAIL.
create function private.raise_error(p_code text, p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail, p_code);
end;
$$;

-- Straight-line (great-circle) distance in metres. Not road distance.
create function private.haversine_m(lat1 double precision, lng1 double precision,
                                    lat2 double precision, lng2 double precision)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select round(2 * 6371008.8 * asin(sqrt(
           power(sin(radians(lat2 - lat1) / 2), 2)
         + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
         )))::integer;
$$;
