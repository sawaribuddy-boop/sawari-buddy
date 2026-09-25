-- SawariBuddy: privileges, Row Level Security, Realtime authorisation, scheduled jobs.
--
-- Model:
--   * anon: nothing.
--   * authenticated: SELECT filtered by RLS; operational writes ONLY through SECURITY DEFINER RPCs;
--     admins additionally write reference data (stops, routes, autos, assignments, drivers, settings) via RLS.
--   * service_role: server-side only (never shipped to mobile/browser).

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from authenticated;

grant update (full_name, phone) on public.profiles to authenticated;
grant insert, update on public.stops, public.routes, public.autos, public.auto_assignments, public.drivers to authenticated;
grant update on public.platform_settings to authenticated;
grant update (status, resolution_note, assigned_to, resolved_at) on public.issues to authenticated;

-- ---------------------------------------------------------------------------
-- RLS helper predicates (SECURITY DEFINER to avoid recursive policy evaluation; all keyed on auth.uid())
-- ---------------------------------------------------------------------------
create function private.is_trip_driver(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.trips t where t.id = p_trip_id and t.driver_id = (select auth.uid()));
$$;

create function private.has_booking_on_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.bookings b where b.trip_id = p_trip_id and b.passenger_id = (select auth.uid()));
$$;

create function private.owns_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.bookings b where b.id = p_booking_id and b.passenger_id = (select auth.uid()));
$$;

create function private.owns_ledger_account(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.ledger_accounts a where a.id = p_account_id and a.owner_profile_id = (select auth.uid()));
$$;

create function private.can_see_ledger_transaction(p_transaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ledger_entries e
      join public.ledger_accounts a on a.id = e.account_id
     where e.transaction_id = p_transaction_id and a.owner_profile_id = (select auth.uid()));
$$;

create function private.is_assigned_auto(p_auto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.auto_assignments aa
                  where aa.auto_id = p_auto_id and aa.driver_id = (select auth.uid()) and aa.revoked_at is null);
$$;

-- Realtime channel `trip:<uuid>`: the trip's driver, passengers with a seat on it, and admins.
create function private.can_join_trip_channel(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_trip_id uuid;
begin
  if p_topic !~ '^trip:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_trip_id := substring(p_topic from 6)::uuid;
  return private.is_admin()
      or private.is_trip_driver(v_trip_id)
      or exists (select 1 from public.bookings b
                  where b.trip_id = v_trip_id and b.passenger_id = (select auth.uid())
                    and b.status in ('CONFIRMED', 'BOARDED'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.autos enable row level security;
alter table public.auto_assignments enable row level security;
alter table public.stops enable row level security;
alter table public.routes enable row level security;
alter table public.platform_settings enable row level security;
alter table public.settings_events enable row level security;
alter table public.trips enable row level security;
alter table public.bookings enable row level security;
alter table public.driver_presence enable row level security;
alter table public.trip_events enable row level security;
alter table public.booking_events enable row level security;
alter table public.issues enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_entries enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- drivers
create policy drivers_select on public.drivers for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy drivers_admin_insert on public.drivers for insert to authenticated
  with check ((select private.is_admin()));
create policy drivers_admin_update on public.drivers for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- autos
create policy autos_select on public.autos for select to authenticated
  using ((select private.is_admin()) or private.is_assigned_auto(id));
create policy autos_admin_insert on public.autos for insert to authenticated
  with check ((select private.is_admin()));
create policy autos_admin_update on public.autos for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- auto_assignments
create policy auto_assignments_select on public.auto_assignments for select to authenticated
  using (driver_id = (select auth.uid()) or (select private.is_admin()));
create policy auto_assignments_admin_insert on public.auto_assignments for insert to authenticated
  with check ((select private.is_admin()));
create policy auto_assignments_admin_update on public.auto_assignments for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- stops & routes: everyone signed in reads active ones; admins manage
create policy stops_select on public.stops for select to authenticated
  using (is_active or (select private.is_admin()));
create policy stops_admin_insert on public.stops for insert to authenticated
  with check ((select private.is_admin()));
create policy stops_admin_update on public.stops for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy routes_select on public.routes for select to authenticated
  using (is_active or (select private.is_admin()));
create policy routes_admin_insert on public.routes for insert to authenticated
  with check ((select private.is_admin()));
create policy routes_admin_update on public.routes for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- settings (clients read the public subset via get_platform_settings_public)
create policy platform_settings_admin_select on public.platform_settings for select to authenticated
  using ((select private.is_admin()));
create policy platform_settings_admin_update on public.platform_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy settings_events_admin_select on public.settings_events for select to authenticated
  using ((select private.is_admin()));

-- trips / bookings / presence / events: read-only for clients
create policy trips_select on public.trips for select to authenticated
  using (driver_id = (select auth.uid()) or (select private.is_admin()) or private.has_booking_on_trip(id));

create policy bookings_select on public.bookings for select to authenticated
  using (passenger_id = (select auth.uid()) or (select private.is_admin()) or private.is_trip_driver(trip_id));

create policy driver_presence_select on public.driver_presence for select to authenticated
  using (driver_id = (select auth.uid()) or (select private.is_admin()));

create policy trip_events_select on public.trip_events for select to authenticated
  using ((select private.is_admin()) or private.is_trip_driver(trip_id) or private.has_booking_on_trip(trip_id));

create policy booking_events_select on public.booking_events for select to authenticated
  using ((select private.is_admin()) or private.is_trip_driver(trip_id) or private.owns_booking(booking_id));

-- issues: raised through raise_issue(); admins triage
create policy issues_select on public.issues for select to authenticated
  using (raised_by = (select auth.uid()) or (select private.is_admin()));
create policy issues_admin_update on public.issues for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ledger: owners read their own accounts' lines; admins read everything; nobody writes directly
create policy ledger_accounts_select on public.ledger_accounts for select to authenticated
  using (owner_profile_id = (select auth.uid()) or (select private.is_admin()));
create policy ledger_transactions_select on public.ledger_transactions for select to authenticated
  using ((select private.is_admin()) or private.can_see_ledger_transaction(id));
create policy ledger_entries_select on public.ledger_entries for select to authenticated
  using ((select private.is_admin()) or private.owns_ledger_account(account_id));

-- ---------------------------------------------------------------------------
-- Realtime: private broadcast channels trip:<id> (receive only; clients never send)
-- ---------------------------------------------------------------------------
create policy trip_channel_receive on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and private.can_join_trip_channel((select realtime.topic())));

-- Status changes are pushed to the trip channel so apps refresh without polling.
create function private.trips_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    perform private.broadcast('trip:' || new.id, 'trip_changed',
      jsonb_build_object('trip_id', new.id, 'status', new.status, 'final_call_at', new.final_call_at,
                         'no_show_eligible_at', new.no_show_eligible_at));
  end if;
  return null;
end;
$$;
create trigger trips_broadcast after update of status on public.trips
  for each row execute function private.trips_broadcast();

create function private.bookings_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.trips;
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    select * into v_trip from public.trips where id = new.trip_id;
    perform private.broadcast('trip:' || new.trip_id, 'booking_changed',
      jsonb_build_object('trip_id', new.trip_id, 'booking_id', new.id, 'source', new.source,
                         'status', new.status, 'seat_count', new.seat_count,
                         'available_seats', v_trip.capacity - private.trip_occupied_seats(new.trip_id)));
  end if;
  return null;
end;
$$;
create trigger bookings_broadcast after insert or update of status on public.bookings
  for each row execute function private.bookings_broadcast();

-- ---------------------------------------------------------------------------
-- Function privileges: nothing executable unless listed here
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function
  public.open_trip(uuid, uuid),
  public.final_call(uuid),
  public.start_trip(uuid),
  public.complete_trip(uuid),
  public.cancel_trip(uuid, public.trip_cancel_reason),
  public.resume_trip(uuid),
  public.go_offline(),
  public.driver_heartbeat(double precision, double precision, real),
  public.book_seats(uuid, smallint, uuid, public.seat_preference),
  public.cancel_booking(uuid),
  public.add_walk_in(uuid, smallint, uuid, text),
  public.remove_walk_in(uuid),
  public.mark_boarded(uuid),
  public.mark_no_show(uuid),
  public.raise_issue(public.issue_kind, text, uuid, uuid),
  public.admin_set_user_role(uuid, public.user_role),
  public.search_trips(uuid, uuid),
  public.get_my_active_booking(),
  public.get_trip_manifest(uuid),
  public.get_platform_settings_public(),
  public.driver_earnings_summary(timestamptz, timestamptz, uuid)
to authenticated;

-- Predicates referenced from RLS policies must be executable by the querying role.
grant execute on function
  private.auth_user_role(),
  private.is_admin(),
  private.is_trip_driver(uuid),
  private.has_booking_on_trip(uuid),
  private.owns_booking(uuid),
  private.owns_ledger_account(uuid),
  private.can_see_ledger_transaction(uuid),
  private.is_assigned_auto(uuid),
  private.can_join_trip_channel(text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Scheduled jobs
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
select cron.schedule('sawari_sweep_unreachable_drivers', '* * * * *', $$select private.sweep_unreachable_drivers()$$);
