-- One account per mobile number (verified by SMS code) and one sign-up per device.
--
-- Mobile number
-- * The number is verified by Supabase Auth: the app calls updateUser({ phone }), the user enters the
--   SMS code (verifyOtp type 'phone_change'), and auth.users.phone is set with phone_confirmed_at.
--   auth.users.phone is unique, so a number verified on one account is refused for any other
--   (Auth error `phone_exists`).
-- * profiles.phone now only ever holds the verified number: a trigger copies it from auth.users, and
--   users can no longer write it directly. Unverified numbers saved before this migration stay until
--   the user verifies one; a newly verified number takes precedence over an unverified copy elsewhere.
-- * platform_settings.phone_verification_required (default off) gates the app: when on, passengers
--   and drivers without a verified number are refused by every function that checks their role
--   (PHONE_NOT_VERIFIED) and the app shows the verification screen. Turn it on once an SMS provider
--   is configured for the project.
--
-- Device
-- * The app sends a SHA-256 hash of the device ID as sign-up metadata `device_id`. A device that already
--   created an account cannot create another (DEVICE_ALREADY_REGISTERED). Logging in from any device
--   is unaffected. Sign-ups without a device ID (seed data, support tools) are not limited.
-- * The device ID is reported by the app, so this stops ordinary repeat sign-ups, not a modified app.
--
-- check_sign_up(phone, device_id) lets the sign-up screen say which rule would refuse the sign-up before
-- creating the account. The sign-up trigger enforces the same rules.

alter table public.platform_settings
  add column phone_verification_required boolean not null default false;

-- ---------------------------------------------------------------------------
-- Devices that have created an account. Private: no client access.
-- ---------------------------------------------------------------------------
create table private.signup_devices (
  device_hash  text primary key check (device_hash ~ '^[0-9a-f]{64}$'),
  user_id      uuid not null,
  created_at   timestamptz not null default now()
);

-- '+919876543210' / '919876543210' / ' +91 98765 43210 ' -> '919876543210' (auth.users.phone format).
create function private.auth_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
$$;

create function private.phone_is_registered(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users u
                  where u.phone = private.auth_phone(p_phone) and u.phone_confirmed_at is not null);
$$;

create function private.device_is_registered(p_device_hash text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.signup_devices where device_hash = lower(p_device_hash));
$$;

-- ---------------------------------------------------------------------------
-- Sign-up: refuse a used device or an already verified number, record the device.
-- (Otherwise unchanged from 20260926000200: new auth user => PASSENGER profile.)
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device text := lower(nullif(btrim(new.raw_user_meta_data ->> 'device_id'), ''));
  v_phone text := nullif(btrim(new.raw_user_meta_data ->> 'phone'), '');
begin
  if v_device is not null and private.device_is_registered(v_device) then
    perform private.raise_error('DEVICE_ALREADY_REGISTERED', 'This device already has an account');
  end if;
  if v_phone is not null and private.phone_is_registered(v_phone) then
    perform private.raise_error('PHONE_ALREADY_REGISTERED', 'This mobile number already has an account');
  end if;

  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'Passenger'), '@', 1)),
    new.email,
    -- Only a verified number (phone sign-ups); a number typed at e-mail sign-up is verified later.
    case when new.phone_confirmed_at is not null then '+' || nullif(new.phone, '') end
  );

  if v_device is not null then
    insert into private.signup_devices (device_hash, user_id) values (v_device, new.id);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- A verified number is copied to the profile.
-- ---------------------------------------------------------------------------
create function private.sync_verified_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := '+' || new.phone;
begin
  if new.phone_confirmed_at is null or nullif(new.phone, '') is null then
    return null;
  end if;
  -- An unverified copy of this number saved on another profile before verification existed.
  update public.profiles set phone = null where phone = v_phone and id <> new.id;
  update public.profiles set phone = v_phone where id = new.id and phone is distinct from v_phone;
  return null;
end;
$$;

create trigger on_auth_user_phone_verified after update of phone, phone_confirmed_at on auth.users
  for each row execute function private.sync_verified_phone();

-- Users change their number only by verifying a new one.
revoke update (phone) on public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- Passenger / driver functions refuse unverified users while verification is required.
-- (Otherwise unchanged from 20260926000200.)
-- ---------------------------------------------------------------------------
create function private.has_verified_phone(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users u
                  where u.id = p_uid and u.phone_confirmed_at is not null and nullif(u.phone, '') is not null);
$$;

create or replace function private.require_role(p_role public.user_role)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or private.auth_user_role() is distinct from p_role then
    perform private.raise_error('NOT_AUTHORISED', format('Requires an active %s account', p_role));
  end if;
  if p_role in ('PASSENGER', 'DRIVER')
     and (select s.phone_verification_required from public.platform_settings s where s.id = 1)
     and not private.has_verified_phone(v_uid) then
    perform private.raise_error('PHONE_NOT_VERIFIED', 'Verify your mobile number first');
  end if;
  return v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Client reads
-- ---------------------------------------------------------------------------

-- Before creating an account: would this number or device be refused? Callable signed out.
create function public.check_sign_up(p_phone text default null, p_device_id text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'phone_registered', p_phone is not null and private.phone_is_registered(p_phone),
    'device_registered', p_device_id is not null and private.device_is_registered(p_device_id));
$$;

-- The signed-in user's number: verified or not, whether the app must ask for it, and the number
-- typed at sign-up (to prefill the verification screen).
create function public.get_my_phone_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'required', (select s.phone_verification_required from public.platform_settings s where s.id = 1),
    'verified', u.phone_confirmed_at is not null and nullif(u.phone, '') is not null,
    'phone', case when u.phone_confirmed_at is not null and nullif(u.phone, '') is not null then '+' || u.phone end,
    'signup_phone', nullif(btrim(u.raw_user_meta_data ->> 'phone'), ''))
    from auth.users u
   where u.id = (select auth.uid());
$$;

revoke execute on function public.check_sign_up(text, text), public.get_my_phone_status() from public;
grant execute on function public.check_sign_up(text, text) to anon, authenticated;
grant execute on function public.get_my_phone_status() to authenticated;
