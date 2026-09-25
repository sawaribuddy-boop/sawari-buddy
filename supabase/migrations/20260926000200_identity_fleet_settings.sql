-- SawariBuddy: identity (profiles, drivers), fleet (autos, assignments), network (stops, routes), settings.

-- ---------------------------------------------------------------------------
-- Profiles: one per auth user. Role is never chosen by the user.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'PASSENGER',
  full_name   text not null check (char_length(btrim(full_name)) between 1 and 80),
  phone       text unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email       text,
  status      public.account_status not null default 'ACTIVE',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- New auth user => PASSENGER profile. Drivers/admins are promoted by an admin.
create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'Passenger'), '@', 1)),
    new.email,
    nullif(new.phone, '')
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Drivers
-- ---------------------------------------------------------------------------
create table public.drivers (
  id              uuid primary key references public.profiles (id) on delete cascade,
  license_number  text not null unique check (char_length(license_number) between 5 and 30),
  status          public.driver_status not null default 'PENDING_VERIFICATION',
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint drivers_active_is_verified check (status <> 'ACTIVE' or verified_at is not null)
);
create trigger drivers_updated_at before update on public.drivers
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Autos and which drivers may operate them
-- ---------------------------------------------------------------------------
create table public.autos (
  id                   uuid primary key default gen_random_uuid(),
  registration_number  text not null unique check (registration_number ~ '^[A-Z0-9]{4,12}$'),
  capacity             smallint not null check (capacity between 1 and 8),
  model                text,
  colour               text,
  status               public.auto_status not null default 'ACTIVE',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger autos_updated_at before update on public.autos
  for each row execute function private.set_updated_at();

create table public.auto_assignments (
  id           uuid primary key default gen_random_uuid(),
  auto_id      uuid not null references public.autos (id),
  driver_id    uuid not null references public.drivers (id),
  assigned_at  timestamptz not null default now(),
  revoked_at   timestamptz,
  constraint auto_assignments_revoked_after check (revoked_at is null or revoked_at >= assigned_at)
);
create unique index auto_assignments_active_uniq on public.auto_assignments (auto_id, driver_id) where revoked_at is null;
create index auto_assignments_driver_idx on public.auto_assignments (driver_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Stops and routes (V1: whole-route bookings, fixed fare per seat)
-- ---------------------------------------------------------------------------
create table public.stops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index stops_active_name_uniq on public.stops (lower(name)) where is_active;

create table public.routes (
  id                   uuid primary key default gen_random_uuid(),
  origin_stop_id       uuid not null references public.stops (id),
  destination_stop_id  uuid not null references public.stops (id),
  fare_paise           bigint not null check (fare_paise > 0),
  approx_distance_m    integer,  -- straight line between the two stops, set by trigger
  display_order        integer not null default 0,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint routes_distinct_stops check (origin_stop_id <> destination_stop_id)
);
create unique index routes_active_pair_uniq on public.routes (origin_stop_id, destination_stop_id) where is_active;
create index routes_destination_idx on public.routes (destination_stop_id);
create trigger routes_updated_at before update on public.routes
  for each row execute function private.set_updated_at();

create function private.routes_set_distance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select private.haversine_m(o.lat, o.lng, d.lat, d.lng)
    into new.approx_distance_m
    from public.stops o, public.stops d
   where o.id = new.origin_stop_id and d.id = new.destination_stop_id;
  return new;
end;
$$;
create trigger routes_distance before insert or update of origin_stop_id, destination_stop_id on public.routes
  for each row execute function private.routes_set_distance();

-- ---------------------------------------------------------------------------
-- Platform settings: exactly one row. Every business threshold lives here.
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  id                                   smallint primary key default 1 check (id = 1),
  commission_bps                       integer  not null default 1000 check (commission_bps between 0 and 10000),
  walk_in_commission_bps               integer  not null default 0    check (walk_in_commission_bps between 0 and 10000),
  max_seats_per_booking                smallint not null default 3    check (max_seats_per_booking between 1 and 8),
  no_show_grace_seconds                integer  not null default 300  check (no_show_grace_seconds between 0 and 3600),
  driver_stale_seconds                 integer  not null default 60   check (driver_stale_seconds between 15 and 3600),
  driver_intervention_seconds          integer  not null default 600  check (driver_intervention_seconds between 60 and 86400),
  location_update_interval_seconds     integer  not null default 10   check (location_update_interval_seconds between 3 and 120),
  min_location_update_interval_seconds integer  not null default 3    check (min_location_update_interval_seconds between 1 and 60),
  updated_at                           timestamptz not null default now(),
  updated_by                           uuid references public.profiles (id),
  constraint settings_intervention_after_stale check (driver_intervention_seconds > driver_stale_seconds),
  constraint settings_heartbeat_within_stale check (location_update_interval_seconds < driver_stale_seconds),
  constraint settings_throttle_below_interval check (min_location_update_interval_seconds <= location_update_interval_seconds)
);
insert into public.platform_settings (id) values (1);

create table public.settings_events (
  id          bigint generated always as identity primary key,
  old_values  jsonb not null,
  new_values  jsonb not null,
  changed_by  uuid,
  created_at  timestamptz not null default now()
);

create function private.platform_settings_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  insert into public.settings_events (old_values, new_values, changed_by)
  values (to_jsonb(old), to_jsonb(new), auth.uid());
  return new;
end;
$$;
create trigger platform_settings_audit before update on public.platform_settings
  for each row execute function private.platform_settings_audit();

create function private.settings()
returns public.platform_settings
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.platform_settings where id = 1;
$$;

-- ---------------------------------------------------------------------------
-- Caller helpers (used by RLS policies and RPCs). All read the caller from auth.uid().
-- ---------------------------------------------------------------------------
create function private.auth_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.status = 'ACTIVE';
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.auth_user_role()) = 'ADMIN', false);
$$;

-- Returns the caller's id if they are an ACTIVE profile with the given role, else raises.
create function private.require_role(p_role public.user_role)
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
  return v_uid;
end;
$$;

-- An ACTIVE, verified driver (profile ACTIVE + driver ACTIVE).
create function private.require_active_driver()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_role('DRIVER');
begin
  if not exists (select 1 from public.drivers d where d.id = v_uid and d.status = 'ACTIVE') then
    perform private.raise_error('DRIVER_NOT_ACTIVE', 'Driver account is not verified or is suspended');
  end if;
  return v_uid;
end;
$$;
