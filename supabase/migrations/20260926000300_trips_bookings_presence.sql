-- SawariBuddy: trips, bookings (app + walk-in occupants), driver presence, audit events, issues.
--
-- Invariants enforced here at table level (defence in depth; the RPCs also check them):
--   * one active trip per driver and per auto
--   * one active booking per passenger
--   * booking/trip status transitions follow STATE_MACHINES.md
--   * occupied seats never exceed the trip's capacity

-- ---------------------------------------------------------------------------
-- Trips
-- ---------------------------------------------------------------------------
create table public.trips (
  id                     uuid primary key default gen_random_uuid(),
  route_id               uuid not null references public.routes (id),
  auto_id                uuid not null references public.autos (id),
  driver_id              uuid not null references public.drivers (id),
  status                 public.trip_status not null default 'OPEN',
  capacity               smallint not null check (capacity between 1 and 8),  -- snapshot of autos.capacity
  fare_paise             bigint not null check (fare_paise > 0),              -- snapshot of routes.fare_paise
  opened_at              timestamptz not null default now(),
  final_call_at          timestamptz,
  no_show_eligible_at    timestamptz,  -- final_call_at + no_show_grace_seconds (snapshotted at final call)
  started_at             timestamptz,
  completed_at           timestamptz,
  cancelled_at           timestamptz,
  cancel_reason          public.trip_cancel_reason,
  suspended_at           timestamptz,
  suspended_from_status  public.trip_status,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint trips_final_call_pair check ((final_call_at is null) = (no_show_eligible_at is null)),
  constraint trips_no_show_after_final_call check (no_show_eligible_at is null or no_show_eligible_at >= final_call_at),
  constraint trips_boarding_has_final_call check (status <> 'BOARDING' or final_call_at is not null),
  constraint trips_started check (status not in ('IN_PROGRESS', 'COMPLETED') or started_at is not null),
  constraint trips_completed check (status <> 'COMPLETED' or completed_at is not null),
  constraint trips_cancelled check (status <> 'CANCELLED' or (cancelled_at is not null and cancel_reason is not null)),
  constraint trips_suspended check (
    (status = 'SUSPENDED') = (suspended_from_status is not null)
    and (status <> 'SUSPENDED' or suspended_at is not null)
  ),
  constraint trips_suspended_from check (suspended_from_status is null or suspended_from_status in ('OPEN', 'BOARDING'))
);
create unique index trips_one_active_per_driver on public.trips (driver_id)
  where status in ('OPEN', 'BOARDING', 'IN_PROGRESS', 'SUSPENDED');
create unique index trips_one_active_per_auto on public.trips (auto_id)
  where status in ('OPEN', 'BOARDING', 'IN_PROGRESS', 'SUSPENDED');
create index trips_route_status_idx on public.trips (route_id, status);
create index trips_driver_created_idx on public.trips (driver_id, created_at desc);
create index trips_status_idx on public.trips (status) where status in ('OPEN', 'BOARDING', 'IN_PROGRESS', 'SUSPENDED');
create trigger trips_updated_at before update on public.trips
  for each row execute function private.set_updated_at();

create function private.trips_guard_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'OPEN' then
      perform private.raise_error('INVALID_TRANSITION', 'A trip must start in OPEN');
    end if;
    return new;
  end if;

  if new.status is distinct from old.status and not (
       (old.status = 'OPEN'        and new.status in ('BOARDING', 'IN_PROGRESS', 'CANCELLED', 'SUSPENDED'))
    or (old.status = 'BOARDING'    and new.status in ('IN_PROGRESS', 'CANCELLED', 'SUSPENDED'))
    or (old.status = 'SUSPENDED'   and new.status in ('OPEN', 'BOARDING', 'CANCELLED'))
    or (old.status = 'IN_PROGRESS' and new.status = 'COMPLETED')
  ) then
    perform private.raise_error('INVALID_TRANSITION', format('Trip cannot move from %s to %s', old.status, new.status));
  end if;

  -- Snapshots and identity are immutable once the trip exists.
  if (new.route_id, new.auto_id, new.driver_id, new.capacity, new.fare_paise, new.opened_at)
     is distinct from (old.route_id, old.auto_id, old.driver_id, old.capacity, old.fare_paise, old.opened_at) then
    perform private.raise_error('IMMUTABLE_FIELD', 'Trip route, auto, driver, capacity and fare cannot change');
  end if;
  return new;
end;
$$;
create trigger trips_guard before insert or update on public.trips
  for each row execute function private.trips_guard_transition();

-- ---------------------------------------------------------------------------
-- Bookings: every occupant of a trip. APP = booked in the app, WALK_IN = boarded from the road.
-- ---------------------------------------------------------------------------
create sequence public.booking_code_seq start with 1001;

create table public.bookings (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique default ('SA' || nextval('public.booking_code_seq')),
  trip_id              uuid not null references public.trips (id),
  source               public.booking_source not null,
  passenger_id         uuid references public.profiles (id),
  walk_in_label        text check (char_length(walk_in_label) <= 40),
  seat_count           smallint not null check (seat_count between 1 and 8),
  seat_preference      public.seat_preference not null default 'ANY',  -- non-binding note for the driver
  status               public.booking_status not null,
  fare_per_seat_paise  bigint not null check (fare_per_seat_paise > 0),
  total_fare_paise     bigint not null,
  platform_fee_paise   bigint not null,
  payment_method       public.payment_method not null default 'CASH',
  idempotency_key      uuid not null,
  created_by           uuid not null references public.profiles (id),
  boarded_at           timestamptz,
  completed_at         timestamptz,
  cancelled_at         timestamptz,
  cancel_reason        public.booking_cancel_reason,
  cancelled_by         uuid references public.profiles (id),
  no_show_at           timestamptz,
  no_show_marked_by    uuid references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint bookings_passenger_matches_source check ((source = 'APP') = (passenger_id is not null)),
  constraint bookings_label_walk_in_only check (walk_in_label is null or source = 'WALK_IN'),
  constraint bookings_app_created_by_passenger check (source <> 'APP' or created_by = passenger_id),
  constraint bookings_total_fare check (total_fare_paise = fare_per_seat_paise * seat_count),
  constraint bookings_fee_range check (platform_fee_paise between 0 and total_fare_paise),
  constraint bookings_boarded check (status not in ('BOARDED', 'COMPLETED') or boarded_at is not null),
  constraint bookings_completed check (status <> 'COMPLETED' or completed_at is not null),
  constraint bookings_cancelled check (status <> 'CANCELLED' or (cancelled_at is not null and cancel_reason is not null)),
  constraint bookings_no_show check (status <> 'NO_SHOW' or (no_show_at is not null and source = 'APP'))
);
-- Idempotency: a retried request (same caller, same key) can never create a second row.
create unique index bookings_idempotency_uniq on public.bookings (created_by, idempotency_key);
-- A passenger holds at most one active booking (CONFIRMED or BOARDED).
create unique index bookings_one_active_per_passenger on public.bookings (passenger_id)
  where status in ('CONFIRMED', 'BOARDED');
create index bookings_trip_status_idx on public.bookings (trip_id, status);
create index bookings_passenger_history_idx on public.bookings (passenger_id, created_at desc) where passenger_id is not null;
create trigger bookings_updated_at before update on public.bookings
  for each row execute function private.set_updated_at();

-- Seats are occupied by CONFIRMED (booked, not yet boarded) and BOARDED bookings.
create function private.booking_occupies_seat(p_status public.booking_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in ('CONFIRMED', 'BOARDED');
$$;

-- Occupied seats on a trip, derived from booking rows. Callers that act on the result
-- must hold the trip row lock (select ... for update) to avoid races.
create function private.trip_occupied_seats(p_trip_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(b.seat_count), 0)::integer
    from public.bookings b
   where b.trip_id = p_trip_id and b.status in ('CONFIRMED', 'BOARDED');
$$;

create function private.bookings_guard_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not ((new.source = 'APP' and new.status = 'CONFIRMED') or (new.source = 'WALK_IN' and new.status = 'BOARDED')) then
      perform private.raise_error('INVALID_TRANSITION', 'App bookings start CONFIRMED; walk-ins start BOARDED');
    end if;
    return new;
  end if;

  if new.status is distinct from old.status and not (
       (old.status = 'CONFIRMED' and new.status in ('BOARDED', 'CANCELLED', 'NO_SHOW'))
    or (old.status = 'BOARDED'   and new.status in ('COMPLETED', 'CANCELLED'))
  ) then
    perform private.raise_error('INVALID_TRANSITION', format('Booking cannot move from %s to %s', old.status, new.status));
  end if;

  if (new.trip_id, new.source, new.passenger_id, new.seat_count, new.fare_per_seat_paise, new.total_fare_paise,
      new.platform_fee_paise, new.idempotency_key, new.created_by, new.code)
     is distinct from
     (old.trip_id, old.source, old.passenger_id, old.seat_count, old.fare_per_seat_paise, old.total_fare_paise,
      old.platform_fee_paise, old.idempotency_key, old.created_by, old.code) then
    perform private.raise_error('IMMUTABLE_FIELD', 'Booking trip, seats, fare and identity cannot change');
  end if;
  return new;
end;
$$;
create trigger bookings_guard before insert or update on public.bookings
  for each row execute function private.bookings_guard_transition();

-- Backstop: occupancy can never exceed capacity, whatever code path writes the row.
-- Takes the same trip row lock the RPCs take, so concurrent writers are serialised.
create function private.bookings_capacity_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_capacity smallint;
begin
  if not private.booking_occupies_seat(new.status) then
    return null;
  end if;
  if tg_op = 'UPDATE' and private.booking_occupies_seat(old.status) then
    return null;  -- seat_count is immutable, so an occupying -> occupying update adds no seats
  end if;
  select t.capacity into v_capacity from public.trips t where t.id = new.trip_id for update;
  if private.trip_occupied_seats(new.trip_id) > v_capacity then
    perform private.raise_error('NO_SEAT_AVAILABLE', 'Trip capacity would be exceeded');
  end if;
  return null;
end;
$$;
create trigger bookings_capacity_guard after insert or update of status on public.bookings
  for each row execute function private.bookings_capacity_guard();

-- ---------------------------------------------------------------------------
-- Driver presence: latest state only, one row per driver, updated in place.
-- Reachability (ONLINE / UNREACHABLE / OFFLINE) is derived from last_seen_at, never stored.
-- ---------------------------------------------------------------------------
create table public.driver_presence (
  driver_id       uuid primary key references public.drivers (id) on delete cascade,
  is_online       boolean not null default false,  -- driver intent (Go Online / Go Offline)
  active_trip_id  uuid references public.trips (id),
  lat             double precision check (lat between -90 and 90),
  lng             double precision check (lng between -180 and 180),
  accuracy_m      real check (accuracy_m >= 0),
  location_at     timestamptz,  -- server time of the last location fix received
  last_seen_at    timestamptz,  -- server time of the last heartbeat of any kind
  updated_at      timestamptz not null default now(),
  constraint presence_location_complete check ((lat is null) = (lng is null) and (lat is null) = (location_at is null))
) with (fillfactor = 70);  -- frequent in-place updates: leave room for HOT updates
create unique index driver_presence_active_trip_uniq on public.driver_presence (active_trip_id) where active_trip_id is not null;

-- Reachable = online and heard from within driver_stale_seconds (DB clock).
create function private.driver_is_reachable(p_driver_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.driver_presence dp
      join public.drivers d on d.id = dp.driver_id and d.status = 'ACTIVE'
      join public.profiles p on p.id = dp.driver_id and p.status = 'ACTIVE'
     where dp.driver_id = p_driver_id
       and dp.is_online
       and dp.last_seen_at >= now() - make_interval(secs => (select s.driver_stale_seconds from public.platform_settings s where s.id = 1))
  );
$$;

-- ---------------------------------------------------------------------------
-- Audit events (append-only, written by triggers so no code path can skip them)
-- ---------------------------------------------------------------------------
create table public.trip_events (
  id           bigint generated always as identity primary key,
  trip_id      uuid not null references public.trips (id) on delete cascade,
  from_status  public.trip_status,
  to_status    public.trip_status not null,
  actor_id     uuid,  -- null = system (scheduled job)
  actor_role   public.user_role,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index trip_events_trip_idx on public.trip_events (trip_id, id);

create table public.booking_events (
  id           bigint generated always as identity primary key,
  booking_id   uuid not null references public.bookings (id) on delete cascade,
  trip_id      uuid not null references public.trips (id) on delete cascade,
  from_status  public.booking_status,
  to_status    public.booking_status not null,
  actor_id     uuid,
  actor_role   public.user_role,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index booking_events_booking_idx on public.booking_events (booking_id, id);
create index booking_events_trip_idx on public.booking_events (trip_id);

create function private.trips_log_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.trip_events (trip_id, from_status, to_status, actor_id, actor_role, metadata)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid(), private.auth_user_role(),
            jsonb_strip_nulls(jsonb_build_object('cancel_reason', new.cancel_reason)));
  end if;
  return null;
end;
$$;
create trigger trips_log_event after insert or update of status on public.trips
  for each row execute function private.trips_log_event();

create function private.bookings_log_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.booking_events (booking_id, trip_id, from_status, to_status, actor_id, actor_role, metadata)
    values (new.id, new.trip_id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid(), private.auth_user_role(),
            jsonb_strip_nulls(jsonb_build_object('cancel_reason', new.cancel_reason)));
  end if;
  return null;
end;
$$;
create trigger bookings_log_event after insert or update of status on public.bookings
  for each row execute function private.bookings_log_event();

-- ---------------------------------------------------------------------------
-- Issues / complaints (passenger, driver, or system-raised)
-- ---------------------------------------------------------------------------
create table public.issues (
  id               uuid primary key default gen_random_uuid(),
  source           public.issue_source not null,
  kind             public.issue_kind not null,
  status           public.issue_status not null default 'OPEN',
  raised_by        uuid references public.profiles (id),
  booking_id       uuid references public.bookings (id),
  trip_id          uuid references public.trips (id),
  driver_id        uuid references public.drivers (id),
  description      text not null check (char_length(description) between 1 and 2000),
  resolution_note  text,
  assigned_to      uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  constraint issues_system_has_no_raiser check ((source = 'SYSTEM') = (raised_by is null))
);
create index issues_status_idx on public.issues (status, created_at desc);
create index issues_raised_by_idx on public.issues (raised_by) where raised_by is not null;
create index issues_trip_idx on public.issues (trip_id) where trip_id is not null;
create index issues_booking_idx on public.issues (booking_id) where booking_id is not null;
create index issues_driver_idx on public.issues (driver_id) where driver_id is not null;
-- At most one open system issue of a kind per trip (sweeps run every minute).
create unique index issues_open_system_per_trip on public.issues (trip_id, kind)
  where source = 'SYSTEM' and status in ('OPEN', 'IN_REVIEW');
create trigger issues_updated_at before update on public.issues
  for each row execute function private.set_updated_at();

-- FK indexes not covered above
create index trips_auto_idx on public.trips (auto_id);
create index bookings_created_by_idx on public.bookings (created_by);
