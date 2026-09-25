# SawariBuddy — Database Design (Supabase Postgres 17)

> Updated for Phase 1. **Source of truth:** `supabase/migrations/`. This document explains the design; if they ever disagree, the migrations win and this doc must be fixed.

| Migration | Contents |
|---|---|
| `20260926000100_schemas_enums.sql` | `private` schema, default-privilege lockdown, enums, shared helpers (`raise_error`, `haversine_m`, `set_updated_at`) |
| `20260926000200_identity_fleet_settings.sql` | `profiles` (+ auth trigger), `drivers`, `autos`, `auto_assignments`, `stops`, `routes`, `platform_settings`, `settings_events`, caller/role helpers |
| `20260926000300_trips_bookings_presence.sql` | `trips`, `bookings`, `driver_presence`, `trip_events`, `booking_events`, `issues`; transition guards, capacity backstop, audit triggers |
| `20260926000400_ledger.sql` | `ledger_accounts`, `ledger_transactions`, `ledger_entries`; zero-sum + immutability triggers; posting helpers; `ledger_account_balances` view |
| `20260926000500_business_functions.sql` | all state-changing RPCs, unreachable-driver sweep |
| `20260926000600_read_functions.sql` | read RPCs (search, active booking, manifest, public settings, earnings) |
| `20260926000700_rls_grants_realtime_cron.sql` | table/function privileges, RLS policies, Realtime channel authorisation + broadcast triggers, pg_cron schedule |

## Conventions
- **Keys:** primary keys are `uuid` (`gen_random_uuid()`), except `profiles.id` = `auth.users.id`, and the append-only logs, which use `bigint identity`.
- **Timestamps:** `timestamptz`. All business timing uses DB `now()`.
- **Money:** integer **paise** as `bigint`, INR only. No floats for money.
- **Coordinates:** `double precision` with range checks. No PostGIS; haversine is enough for V1.
- **Enums:** Postgres enums, mirrored in `packages/constants`.
- **Schemas:**
  - `public` holds tables and client RPCs.
  - `private` holds internal helpers. It isn't exposed through the API, and its functions aren't executable by clients except the RLS predicates.
- **Functions** are `SECURITY DEFINER` with `set search_path = ''` and fully qualified names.
- **Business errors** are raised with SQLSTATE `P0001`. `MESSAGE` holds a stable code (e.g. `NO_SEAT_AVAILABLE`) and `DETAIL` a human explanation. `packages/constants` maps codes to UI text.
- **No execute by default:** functions aren't executable by `PUBLIC`/`anon`; each client RPC is granted to `authenticated` explicitly. *Note:* the default is revoked globally for the `postgres` role, so functions from extensions added later must be granted explicitly if clients need them.

---

## 1. Entity-relationship overview

```
auth.users 1─1 profiles ──┬── 1─1 drivers ──┬── * auto_assignments * ── autos
                          │                 ├── 1─1 driver_presence (latest state only)
                          │                 └── * trips
                          └── (passenger) * bookings

stops 1─* routes (origin_stop_id, destination_stop_id)
routes 1─* trips ;  autos 1─* trips
trips 1─* bookings (source APP | WALK_IN)      ← occupancy is derived from these rows
trips 1─* trip_events ;  bookings 1─* booking_events
issues ──(optional)── bookings / trips / drivers
ledger_accounts 1─* ledger_entries *─1 ledger_transactions ──(optional)── bookings / trips
platform_settings (single row) 1─* settings_events
```

## 2. Enums

| Enum | Values |
|---|---|
| `user_role` | `PASSENGER`, `DRIVER`, `ADMIN` |
| `account_status` | `ACTIVE`, `SUSPENDED` |
| `driver_status` | `PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED` |
| `auto_status` | `ACTIVE`, `INACTIVE` |
| `trip_status` | `OPEN`, `BOARDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `SUSPENDED` |
| `trip_cancel_reason` | `DRIVER_CANCELLED`, `DRIVER_OFFLINE`, `DRIVER_UNREACHABLE`, `ADMIN_CANCELLED` |
| `booking_source` | `APP`, `WALK_IN` |
| `booking_status` | `CONFIRMED`, `BOARDED`, `COMPLETED`, `CANCELLED`, `NO_SHOW` |
| `booking_cancel_reason` | `PASSENGER_CANCELLED`, `TRIP_CANCELLED`, `DRIVER_UNREACHABLE`, `WALK_IN_REMOVED`, `ADMIN_CANCELLED` |
| `seat_preference` | `ANY`, `BACK`, `FRONT` |
| `payment_method` | `CASH` (future values added with `alter type … add value`) |
| `ledger_account_type` | `PASSENGER_CREDIT`, `DRIVER_SETTLEMENT`, `PLATFORM_REVENUE`, `PLATFORM_CASH`, `PAYMENT_CLEARING` |
| `ledger_entry_type` | `PAYMENT`, `BOOKING_DEBIT`, `REFUND_CREDIT`, `ADJUSTMENT`, `DRIVER_EARNING`, `PLATFORM_FEE`, `SETTLEMENT` |
| `issue_source` / `issue_kind` / `issue_status` | see STATE_MACHINES §4 |

## 3. Tables (key columns and constraints)

### Identity & fleet
- **`profiles`**
  - Columns: `id`, `role` (default `PASSENGER`), `full_name`, `phone` (E.164, unique), `email`, `status`.
  - Created by a trigger on `auth.users`, always as `PASSENGER`.
  - Clients can update only `full_name` and `phone` (column grant). Roles change only through `admin_set_user_role`.
- **`drivers`**: `id` → profiles, `license_number` (unique), `status`, `verified_at` (required when `ACTIVE`).
- **`autos`**: `registration_number` (unique, `^[A-Z0-9]{4,12}$`), `capacity` (1–8), `status`.
- **`auto_assignments`**: which drivers may operate which autos. Unique active pair, and revoking sets `revoked_at`.
- **`stops`**: `name` (unique among active), `lat`, `lng`, `is_active`.
- **`routes`**:
  - Columns: `origin_stop_id`, `destination_stop_id` (must differ; unique active pair), `fare_paise`, `display_order`, `is_active`.
  - `approx_distance_m` is set by a trigger (haversine).
- **`platform_settings`**: a single row (`id = 1`) with every tunable business rule (PROJECT_SPEC §7), plus cross-field checks (e.g. intervention > stale > heartbeat interval). Every change is audited into `settings_events`.

### Operations
- **`trips`**
  - Columns: `route_id`, `auto_id`, `driver_id`, `status`, snapshotted `capacity` and `fare_paise`, and lifecycle timestamps `opened_at`, `final_call_at`, **`no_show_eligible_at`**, `started_at`, `completed_at`, `cancelled_at` (+ `cancel_reason`), `suspended_at` (+ `suspended_from_status`).
  - Check constraints tie timestamps to status (e.g. `BOARDING ⇒ final_call_at`; `final_call_at` and `no_show_eligible_at` are set together, and `no_show_eligible_at ≥ final_call_at`).
  - Partial unique indexes: one active trip per driver, and one per auto.
  - The `trips_guard` trigger enforces legal transitions and immutable snapshots.
- **`bookings`**: every occupant of a trip.
  - Columns: `code` (`SA1001`…), `trip_id`, `source`, `passenger_id` (required iff `APP`), `walk_in_label`, `seat_count`, `seat_preference` (non-binding), `status`, snapshotted `fare_per_seat_paise` / `total_fare_paise` / `platform_fee_paise`, `payment_method`, `idempotency_key` (required for **both** app bookings and walk-ins), `created_by`, lifecycle timestamps, cancel/no-show audit columns.
  - Indexes:
    - `unique (created_by, idempotency_key)`: idempotency;
    - `unique (passenger_id) where status in ('CONFIRMED','BOARDED')`: one active booking per passenger;
    - `(trip_id, status)`: occupancy.
  - Triggers:
    - `bookings_guard`: legal transitions and immutable fields;
    - `bookings_capacity_guard`: a backstop that locks the trip row and rejects any write that would exceed capacity, whatever the write path;
    - an audit trigger and a realtime broadcast trigger.
- **`driver_presence`**: one row per driver, **updated in place** (`fillfactor = 70` for HOT updates).
  - Columns: `is_online`, `active_trip_id`, `lat`/`lng`/`accuracy_m`/`location_at`, `last_seen_at`.
  - No location history.
- **`trip_events`**, **`booking_events`**: append-only audit rows (from/to status, actor, actor role, metadata), written by triggers.
- **`issues`**: passenger, driver and system issues. A partial unique index allows only one open system issue per (trip, kind).

### Finance: append-only double-entry ledger
- **`ledger_accounts`**: `(type, owner_profile_id)` unique with `nulls not distinct`. Per-person accounts have an owner; platform accounts are singletons.
- **`ledger_transactions`**: one business event, with `type`, a **unique `idempotency_key`**, references (`booking_id`, `trip_id`, `reverses_transaction_id`), `description` and `created_by`.
- **`ledger_entries`**: lines with `account_id`, `entry_type` and signed, non-zero `amount_paise`.
- **Invariants:**
  - **Σ amount per transaction = 0, with ≥ 2 lines.** This is a deferred constraint trigger, checked at commit.
  - **No UPDATE / DELETE / TRUNCATE** on any ledger table. Triggers raise `LEDGER_IMMUTABLE`, even for superusers.
  - **Balances are derived.** The `ledger_account_balances` view (`security_invoker`) sums the entries, and no balance is ever stored.

**Sign convention:** positive = value credited to the holder (the platform owes them); negative = the holder owes the platform.

**V1 postings (cash only)**, made by `complete_trip`. There is one transaction per completed booking, with key `booking_fare:<booking_id>`. For an app fare of ₹40 at 10%:

| entry_type | account | amount |
|---|---|---|
| `PAYMENT` (cash collected by driver) | DRIVER_SETTLEMENT(driver) | −4000 |
| `DRIVER_EARNING` | DRIVER_SETTLEMENT(driver) | +3600 |
| `PLATFORM_FEE` | PLATFORM_REVENUE | +400 |

After this posting, the driver's settlement balance is −400: the driver owes the platform its fee. Walk-ins use `walk_in_commission_bps` (default 0), so the zero fee line is skipped.

**Extensible without schema changes:** `BOOKING_DEBIT`, `REFUND_CREDIT` and `SETTLEMENT` entry types, and `PASSENGER_CREDIT`, `PLATFORM_CASH` and `PAYMENT_CLEARING` accounts, are already modelled. Later phases can support these just by adding posting functions:
- **Prepaid bookings:** `PAYMENT` into `PAYMENT_CLEARING`, then `BOOKING_DEBIT` at completion.
- **Refund credits:** `REFUND_CREDIT` into `PASSENGER_CREDIT`.
- **Cash or digital settlements:** `SETTLEMENT` between `DRIVER_SETTLEMENT` and `PLATFORM_CASH`.

A `settlements` table, and `payment_method` values beyond `CASH`, will be added by migration when those flows are built. None of this is implemented in Phase 1: no payment provider, no top-ups, no prepaid payments, no refunds.

## 4. Occupancy and the booking transaction

`available_seats = trip.capacity − Σ seat_count of the trip's CONFIRMED and BOARDED bookings`, computed by `private.trip_occupied_seats`. There is no stored counter. App bookings and walk-ins share one table and one formula.

`book_seats(trip_id, seat_count, idempotency_key, seat_preference)`:
1. Check the caller is an active passenger. If a booking already exists with the caller's idempotency key, return it, but raise `IDEMPOTENCY_KEY_REUSED` if the parameters differ.
2. Validate `seat_count` (1 … `max_seats_per_booking`).
3. `select … from trips where id = $1 for update`. This **serialises every seat change on this trip**, while other trips proceed in parallel.
4. Re-check idempotency under the lock, since a concurrent duplicate may have just committed.
5. Check the trip is `OPEN` (`TRIP_NOT_BOOKABLE`) and the driver is reachable (`DRIVER_UNREACHABLE`), and that the passenger has no other active booking (`ALREADY_HAS_ACTIVE_BOOKING`).
6. Recompute occupancy from the rows. If `occupied + seat_count > capacity`, raise `NO_SEAT_AVAILABLE`.
7. Insert the booking with the fare and fee snapshot. A `unique_violation` from a cross-trip race is mapped to the right code.

`add_walk_in`, `cancel_booking`, `mark_boarded`, `mark_no_show`, `remove_walk_in`, `final_call`, `start_trip`, `complete_trip` and `cancel_trip` all take the same trip row lock first. **Lock order everywhere:** trip → booking → driver_presence, which prevents deadlocks. `READ COMMITTED` is sufficient because the occupancy read happens after the lock is acquired.

The `bookings_capacity_guard` trigger repeats the capacity check under the same lock on **every** insert or re-activation. So even a privileged direct write can't overbook.

## 5. RPCs

| Function | Caller | Purpose |
|---|---|---|
| `book_seats` | passenger | concurrency-safe, idempotent booking |
| `cancel_booking` | passenger | `CONFIRMED` → `CANCELLED` (free in V1), idempotent |
| `open_trip` | driver | Go Online: open a trip for an assigned auto + route |
| `final_call` | driver | `OPEN` → `BOARDING`; sets `final_call_at`, `no_show_eligible_at` |
| `add_walk_in` / `remove_walk_in` | driver | walk-in passengers (idempotent add) |
| `mark_boarded` / `mark_no_show` | driver | boarding and no-show (after grace) |
| `start_trip` / `complete_trip` | driver (complete: + admin) | depart / finish + ledger postings |
| `cancel_trip` | driver / admin | cancel before departure or a suspended trip |
| `resume_trip` | driver | after being unreachable |
| `go_offline` | driver | stop being online; auto-cancels an empty trip |
| `driver_heartbeat(lat?, lng?, accuracy?)` | driver | liveness + latest location, throttled, broadcast to `trip:<id>` |
| `raise_issue` | passenger / driver | complaint about own booking/trip |
| `admin_set_user_role` | admin | promote to driver/admin |
| `search_trips(origin, destination)` | signed-in | bookable trips with server-computed `available_seats` and driver location |
| `get_my_active_booking()` | passenger | booking + trip + auto + driver reachability/location |
| `get_trip_manifest(trip)` | driver (own) / admin | occupants (first names only), occupancy, `no_show_allowed` |
| `get_platform_settings_public()` | signed-in | heartbeat interval, limits, grace |
| `driver_earnings_summary(from?, to?, driver?)` | driver (own) / admin | earnings, cash collected, trips, settlement balance |
| `private.sweep_unreachable_drivers()` | pg_cron, every minute | suspension / auto-cancel / system issues / mark vanished drivers offline |

## 6. Row Level Security

RLS is enabled on every table. `anon` has no table or function access. Clients (`authenticated`) never write `trips`, `bookings`, `driver_presence`, events or the ledger directly.

| Table | Passenger | Driver | Admin |
|---|---|---|---|
| profiles | own (update name/phone) | own | all |
| drivers | — | own | read/insert/update |
| autos | — | assigned autos | read/insert/update |
| auto_assignments | — | own | read/insert/update |
| stops, routes | active | active | all + insert/update |
| platform_settings, settings_events | public subset via RPC | public subset via RPC | read/update, audit read |
| trips | trips they have a booking on | own | all (writes via RPC only) |
| bookings | own | on own trips | all (writes via RPC only) |
| driver_presence | — (via search / active booking RPCs) | own | all |
| trip_events / booking_events | own trips / bookings | own trips | all |
| issues | raised by self | raised by self | all + update |
| ledger_* | own accounts (none in V1) | own settlement account | all (read) |

Other people's personal data is never exposed through tables. Drivers see passengers' **first names** only, via `get_trip_manifest`. Passengers see drivers' first names, auto details and location only through `search_trips` / `get_my_active_booking`.

**Realtime:**
- **Channels:** private broadcast channels `trip:<uuid>`.
- **Who can join:** a policy on `realtime.messages` lets in the trip's driver, passengers holding a `CONFIRMED`/`BOARDED` booking on it, and admins.
- **Events:** `location`, `trip_changed` and `booking_changed` (which includes `available_seats`). They are emitted from inside the database transaction, so they're delivered only if it commits.

## 7. Scheduled jobs (pg_cron)

| Job | Schedule | Action |
|---|---|---|
| `sawari_sweep_unreachable_drivers` | every minute | see STATE_MACHINES §1 |
