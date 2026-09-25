# SawariBuddy — Database Design (Supabase Postgres)

> Phase 0 design. Implemented as SQL migrations in `supabase/migrations/` from Phase 1. Names and types here are the contract; small changes will be recorded in migrations and this doc together.

Conventions
- Primary keys `uuid` (`gen_random_uuid()`), except `profiles.id` = `auth.users.id`.
- Timestamps `timestamptz`, default `now()`. All business timing uses DB `now()`.
- Money in **paise** as `bigint`. No floats for money.
- Coordinates `double precision` (lat −90..90, lng −180..180, check constraints). No PostGIS in V1; haversine is enough.
- Enums as Postgres `enum` types (stable, small sets), mirrored in `packages/constants`.
- Every table has RLS **enabled**. Clients get `SELECT` through policies; **all state-changing business operations go through `SECURITY DEFINER` functions** with explicit checks. Direct `INSERT/UPDATE/DELETE` from clients is revoked except where noted.
- Functions set `search_path = ''` and fully qualify names.

---

## 1. Entity-relationship overview

```
auth.users 1─1 profiles ──┬── 1─1 drivers ──┬── * auto_assignments * ── autos
                          │                 ├── 1─1 driver_presence
                          │                 └── * trips
                          │
                          └── (passenger) * bookings

stops 1─* routes (origin_stop_id, destination_stop_id)
routes 1─* trips
autos  1─* trips
trips  1─* bookings (source APP | WALK_IN)
trips  1─* trip_events
bookings 1─* booking_events

ledger_accounts 1─* ledger_entries *─1 ledger_transactions ──(optional ref)── bookings / trips / settlements
drivers 1─* settlements
issues ──(optional ref)── bookings / trips / drivers
platform_settings (single row)
```

---

## 2. Enums

| Enum | Values |
|---|---|
| `user_role` | `PASSENGER`, `DRIVER`, `ADMIN` |
| `account_status` | `ACTIVE`, `SUSPENDED` |
| `driver_status` | `PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED` |
| `auto_status` | `ACTIVE`, `INACTIVE` |
| `trip_status` | `OPEN`, `BOARDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `SUSPENDED` |
| `booking_source` | `APP`, `WALK_IN` |
| `booking_status` | `PENDING`, `CONFIRMED`, `WAITING`, `BOARDED`, `COMPLETED`, `CANCELLED`, `NO_SHOW` |
| `booking_cancel_reason` | `PASSENGER_CANCELLED`, `TRIP_CANCELLED`, `DRIVER_UNREACHABLE`, `WALK_IN_REMOVED`, `ADMIN_CANCELLED`, `HOLD_EXPIRED` |
| `seat_preference` | `ANY`, `BACK`, `FRONT` |
| `payment_method` | `CASH` (future: `ONLINE`, `PLATFORM_CREDIT`) |
| `ledger_account_type` | `PASSENGER_CREDIT`, `DRIVER_SETTLEMENT`, `PLATFORM_REVENUE`, `PLATFORM_CASH`, `PAYMENT_CLEARING` |
| `ledger_transaction_type` | `PAYMENT`, `BOOKING_DEBIT`, `REFUND_CREDIT`, `ADJUSTMENT`, `DRIVER_EARNING`, `PLATFORM_FEE`, `SETTLEMENT` |
| `issue_source` | `PASSENGER`, `DRIVER`, `SYSTEM` |
| `issue_kind` | `DRIVER_UNREACHABLE`, `TRIP_STUCK`, `BOOKING_ISSUE`, `DRIVER_BEHAVIOUR`, `PAYMENT`, `OTHER` |
| `issue_status` | `OPEN`, `IN_REVIEW`, `RESOLVED`, `CLOSED` |

---

## 3. Tables

### 3.1 Identity

**`profiles`**: one per auth user
| column | type | notes |
|---|---|---|
| id | uuid PK | FK `auth.users(id)` on delete cascade |
| role | user_role | default `PASSENGER`; only admins can change (column privilege + trigger) |
| full_name | text | not null, 1–80 chars |
| phone | text null | E.164, unique when present |
| email | text null | mirrored from auth for admin search |
| status | account_status | default `ACTIVE` |
| created_at, updated_at | timestamptz | |

Created by an `after insert on auth.users` trigger (role always `PASSENGER`; drivers/admins are promoted by admin actions).

**`drivers`**: driver-specific data
| column | type | notes |
|---|---|---|
| id | uuid PK | FK `profiles(id)` |
| license_number | text | unique |
| status | driver_status | default `PENDING_VERIFICATION` |
| verified_at | timestamptz null | |
| created_at | timestamptz | |

### 3.2 Fleet & network

**`autos`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| registration_number | text | unique, upper-case normalised (e.g. `DL01AB1234`) |
| capacity | smallint | check 1–8 |
| model, colour | text null | display only |
| status | auto_status | |
| created_at, updated_at | | |

**`auto_assignments`**: which drivers may operate which autos
| column | type | notes |
|---|---|---|
| auto_id | uuid FK | |
| driver_id | uuid FK | |
| assigned_at | timestamptz | |
| revoked_at | timestamptz null | |
| | | unique (auto_id, driver_id) where `revoked_at is null` |

**`stops`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | unique among active |
| lat, lng | double precision | checks |
| is_active | boolean | |

**`routes`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| origin_stop_id, destination_stop_id | uuid FK stops | check origin ≠ destination; unique pair among active |
| fare_paise | bigint | check > 0 |
| approx_distance_m | integer null | straight-line, computed from stops at insert |
| display_order | integer | for "Popular routes" |
| is_active | boolean | |

### 3.3 Operations

**`trips`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| route_id, auto_id, driver_id | uuid FK | |
| status | trip_status | |
| capacity | smallint | **snapshot** of `autos.capacity` at open |
| fare_paise | bigint | **snapshot** of `routes.fare_paise` at open |
| opened_at | timestamptz | |
| final_call_at | timestamptz null | set on `BOARDING` |
| started_at, completed_at, cancelled_at | timestamptz null | |
| cancel_reason | text null | |
| suspended_at | timestamptz null | |
| suspended_from_status | trip_status null | check in (`OPEN`,`BOARDING`) |
| created_at, updated_at | | |

Indexes / constraints
- `unique (driver_id) where status in ('OPEN','BOARDING','IN_PROGRESS','SUSPENDED')`: one active trip per driver.
- `unique (auto_id) where status in (…same…)`: one active trip per auto.
- `index (route_id, status)`: search.
- check: timestamps consistent with status (e.g. `status = 'IN_PROGRESS' → started_at is not null`).

**`bookings`**: every occupant of a trip, app or walk-in
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| code | text | unique, `'SA' || nextval('booking_code_seq')` (e.g. `SA1001`) |
| trip_id | uuid FK | |
| source | booking_source | |
| passenger_id | uuid FK profiles null | **required when `APP`, null when `WALK_IN`** (check) |
| walk_in_label | text null | optional note for walk-ins, ≤ 40 chars |
| seat_count | smallint | check ≥ 1 |
| seat_preference | seat_preference | default `ANY` |
| status | booking_status | |
| fare_per_seat_paise | bigint | snapshot from trip |
| total_fare_paise | bigint | `fare_per_seat_paise × seat_count` (check) |
| platform_fee_paise | bigint | snapshot using commission at booking time (check 0 ≤ fee ≤ total) |
| payment_method | payment_method | `CASH` in V1 |
| idempotency_key | uuid null | required for `APP` |
| created_by | uuid FK profiles | passenger (APP) or driver (WALK_IN) |
| hold_expires_at | timestamptz null | only for `PENDING` (future) |
| confirmed_at, waiting_since, boarded_at, completed_at, cancelled_at, no_show_at | timestamptz null | |
| cancel_reason | booking_cancel_reason null | |
| cancelled_by | uuid null | |
| created_at, updated_at | | |

Indexes / constraints
- `unique (created_by, idempotency_key)`: idempotent booking.
- `unique (passenger_id) where status in ('PENDING','CONFIRMED','WAITING','BOARDED')`: one active booking per passenger (A4).
- `index (trip_id, status)`: occupancy computation.
- `index (passenger_id, created_at desc)`: history.

**`driver_presence`**: latest state only, one row per driver, updated in place
| column | type | notes |
|---|---|---|
| driver_id | uuid PK FK drivers | |
| is_online | boolean | driver intent |
| active_trip_id | uuid FK trips null | |
| lat, lng | double precision null | |
| accuracy_m | real null | |
| location_at | timestamptz null | when location last changed (server time) |
| last_seen_at | timestamptz null | last heartbeat |
| unreachable_issue_raised_at | timestamptz null | de-dupe system issues per outage |
| updated_at | timestamptz | |

This row is **updated**, not appended, every ~10 s. Postgres handles this fine at V1 scale. The table should get a low `fillfactor` (e.g. 70) to allow HOT updates.

**`trip_events`**, **`booking_events`**: append-only audit
| column | type |
|---|---|
| id | bigint identity PK |
| trip_id / booking_id | uuid FK |
| from_status, to_status | enum null |
| actor_id | uuid null (null = system) |
| actor_role | user_role null |
| reason | text null |
| metadata | jsonb default `{}` |
| created_at | timestamptz |

Written by triggers on status change, so no code path can forget them.

### 3.4 Finance: append-only double-entry ledger

**`ledger_accounts`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| type | ledger_account_type | |
| owner_profile_id | uuid FK profiles null | passenger/driver owner; null for platform accounts |
| created_at | | |
| | | unique (type, owner_profile_id); platform accounts are singletons |

**`ledger_transactions`**: one business event
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| type | ledger_transaction_type | primary classification of the event |
| idempotency_key | text | **unique**, e.g. `trip_completion:booking:<id>`, `settlement:<id>` |
| booking_id, trip_id, settlement_id | uuid null FKs | reference |
| reverses_transaction_id | uuid null FK self | corrections |
| description | text | |
| created_by | uuid null | null = system |
| created_at | timestamptz | |

**`ledger_entries`**: lines
| column | type | notes |
|---|---|---|
| id | bigint identity PK | |
| transaction_id | uuid FK | |
| account_id | uuid FK | |
| entry_type | ledger_transaction_type | what this line represents (e.g. the `DRIVER_EARNING` line within a fare transaction) |
| amount_paise | bigint | signed, ≠ 0 |
| created_at | | |

Invariants
- **Σ amount_paise per transaction = 0**, enforced by a `DEFERRABLE INITIALLY DEFERRED` constraint trigger.
- `UPDATE`/`DELETE` on all three ledger tables are revoked from every role, including via a trigger that raises, so even `service_role` can't mutate history by accident.
- Balance of an account = `Σ amount_paise` of its entries (view `ledger_account_balances`).

Sign convention: **positive = the platform owes the account holder / value credited to them**; negative = the holder owes the platform. Platform accounts use the mirror side so every transaction nets to zero.

#### Postings in V1 (cash)

A completed APP booking, fare ₹40, commission 10%:

| entry_type | account | amount |
|---|---|---|
| `PAYMENT` (cash collected by driver) | DRIVER_SETTLEMENT(driver) | −4000 |
| `DRIVER_EARNING` | DRIVER_SETTLEMENT(driver) | +3600 |
| `PLATFORM_FEE` | PLATFORM_REVENUE | +400 |
| **Σ** | | **0** |

Driver settlement balance after this = −400, i.e. the driver owes the platform ₹4.

Driver settles ₹4 in cash to the platform (admin records it):

| entry_type | account | amount |
|---|---|---|
| `SETTLEMENT` | DRIVER_SETTLEMENT(driver) | +400 |
| `SETTLEMENT` | PLATFORM_CASH | −400 |

Reports
- **Driver earnings (period)** = Σ `DRIVER_EARNING` lines for the driver's account in the period.
- **Settlement balance** = Σ all lines on DRIVER_SETTLEMENT(driver).
- **Platform revenue** = Σ `PLATFORM_FEE` lines.

#### Future postings (designed, not produced in V1)
- Online prepaid booking: `PAYMENT` into PAYMENT_CLEARING, then `BOOKING_DEBIT` / `DRIVER_EARNING` (positive, platform owes driver) / `PLATFORM_FEE` at completion.
- Cancellation / driver unreachable after prepayment: `REFUND_CREDIT` to PASSENGER_CREDIT (platform credit, not withdrawable cash). This is subject to the wallet/regulatory review before launch.
- Payout to driver: `SETTLEMENT` from DRIVER_SETTLEMENT to PLATFORM_CASH.

**`settlements`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| driver_id | uuid FK | |
| direction | text | check in (`DRIVER_TO_PLATFORM`, `PLATFORM_TO_DRIVER`) |
| amount_paise | bigint | > 0 |
| method | text | `CASH` / `BANK_TRANSFER` / `UPI` (free text reference in V1) |
| reference | text null | |
| status | text | `RECORDED` in V1 |
| recorded_by | uuid FK profiles (admin) | |
| created_at | | |

Recorded via `record_settlement()`, which writes the settlement row and its ledger transaction atomically.

### 3.5 Support & configuration

**`issues`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| source | issue_source | |
| kind | issue_kind | |
| status | issue_status | |
| raised_by | uuid null | null for SYSTEM |
| booking_id, trip_id, driver_id | uuid null FKs | |
| description | text | |
| resolution_note | text null | |
| assigned_to | uuid null (admin) | |
| created_at, updated_at, resolved_at | | |

**`platform_settings`**: single row (`id smallint PK check (id = 1)`), typed columns listed in PROJECT_SPEC §7, plus `updated_by`, `updated_at`. Changes audited to `settings_events` (old/new jsonb).

---

## 4. Views & read functions

| Name | Purpose | Access |
|---|---|---|
| `trip_occupancy` (view) | `trip_id, capacity, occupied_seats, available_seats`, computed from bookings | driver (own trips), admin |
| `search_trips(origin_stop_id, destination_stop_id)` | bookable trips: `OPEN`, driver reachable, driver/auto active, `available_seats > 0`; returns auto reg, driver first name, fare, available seats, driver lat/lng + `location_at` | any authenticated passenger. `SECURITY DEFINER` so it exposes only these columns |
| `get_my_active_booking()` | booking + trip + driver presence snapshot | passenger |
| `ledger_account_balances` (view) | balance per account | driver (own), admin |
| `driver_earnings_summary(from, to)` | today / period earnings, trips count, settlement balance | driver (own), admin (any) |
| `get_platform_settings_public()` | settings clients need (intervals, max seats, grace) | authenticated |

---

## 5. Write functions (RPCs): the only way to change state

All `SECURITY DEFINER`, check `auth.uid()` and role, raise typed errors (`SQLSTATE` `P0001` with a stable `MESSAGE` code such as `NO_SEAT_AVAILABLE`), and write audit rows via triggers.

| Function | Caller | Summary |
|---|---|---|
| `book_seats(trip_id, seat_count, seat_preference, idempotency_key)` | passenger | see §6 |
| `cancel_booking(booking_id)` | passenger | `CONFIRMED`/`WAITING` → `CANCELLED` |
| `open_trip(auto_id, route_id)` | driver | Go Online |
| `final_call(trip_id)` | driver | `OPEN` → `BOARDING` |
| `add_walk_in(trip_id, seat_count, label?)` | driver | locked, like `book_seats` |
| `remove_walk_in(booking_id)` | driver | |
| `mark_boarded(booking_id)` | driver | |
| `mark_no_show(booking_id)` | driver | grace check |
| `start_trip(trip_id)` | driver | |
| `complete_trip(trip_id)` | driver/admin | completes bookings + posts ledger, idempotent |
| `cancel_trip(trip_id, reason)` | driver/admin | |
| `resume_trip(trip_id)` | driver | from `SUSPENDED` |
| `go_offline()` | driver | fails if active trip |
| `driver_heartbeat(lat?, lng?, accuracy_m?)` | driver | updates presence; throttled; broadcasts location to `trip:<id>` |
| `sweep_unreachable_drivers()` | pg_cron (every minute) | suspension + system issues |
| `record_settlement(...)`, `post_adjustment(...)` | admin | ledger |
| `raise_issue(...)` | passenger/driver | |
| admin CRUD | admin | via RLS-permitted table writes on reference data (stops, routes, autos, assignments) and RPCs for role changes |

---

## 6. `book_seats`: the concurrency-critical function

```sql
-- sketch, not final code
create function public.book_seats(p_trip_id uuid, p_seat_count smallint,
                                  p_seat_preference seat_preference, p_idempotency_key uuid)
returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_trip public.trips;
  v_settings public.platform_settings;
  v_occupied int;
  v_existing public.bookings;
  v_booking public.bookings;
begin
  -- 0. caller must be an ACTIVE passenger
  -- 1. idempotency: same key → same result
  select * into v_existing from public.bookings
   where created_by = v_uid and idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;

  select * into v_settings from public.platform_settings where id = 1;
  -- 2. validate seat_count 1..max_seats_per_booking

  -- 3. LOCK the trip row: serialises every seat change on this trip
  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found or v_trip.status <> 'OPEN' then raise exception 'TRIP_NOT_BOOKABLE'; end if;

  -- 4. driver reachability (derived, using DB time)
  perform 1 from public.driver_presence dp
   where dp.driver_id = v_trip.driver_id and dp.is_online
     and dp.last_seen_at >= now() - make_interval(secs => v_settings.driver_stale_seconds);
  if not found then raise exception 'DRIVER_UNREACHABLE'; end if;

  -- 5. recompute occupancy from rows, under the lock
  select coalesce(sum(seat_count), 0) into v_occupied from public.bookings
   where trip_id = p_trip_id
     and (status in ('CONFIRMED','WAITING','BOARDED')
          or (status = 'PENDING' and hold_expires_at > now()));
  if v_occupied + p_seat_count > v_trip.capacity then
    raise exception 'NO_SEAT_AVAILABLE';
  end if;

  -- 6. insert (one-active-booking unique index may raise → map to ALREADY_HAS_ACTIVE_BOOKING;
  --    a concurrent retry with the same idempotency key → unique violation → re-select and return)
  insert into public.bookings (...) values (...) returning * into v_booking;
  return v_booking;
end $$;
```

Why the trip row lock: every function that changes occupancy (`book_seats`, `add_walk_in`, `cancel_booking`, `mark_no_show`, `remove_walk_in`, `final_call`, `start_trip`, `cancel_trip`) first takes `FOR UPDATE` on the same trip row, so all seat decisions on one trip are serialised while different trips proceed in parallel. `READ COMMITTED` isolation is sufficient because the occupancy read happens after acquiring the lock.

Verified by an automated concurrency test (Phase 1): N parallel `book_seats` calls against one remaining seat must produce exactly one success.

---

## 7. Row Level Security summary

Helper functions (`SECURITY DEFINER`, stable): `public.auth_user_role()` (avoids the reserved `current_role`), `public.is_admin()`, `public.is_driver_of_trip(trip_id)`.

| Table | Passenger | Driver | Admin |
|---|---|---|---|
| profiles | own row (read, update name/phone) | own row; names of passengers on own trips via function | all |
| drivers | — | own | all (write) |
| autos | via `search_trips` only | assigned autos | all (write) |
| auto_assignments | — | own | all (write) |
| stops, routes | read active | read active | all (write) |
| trips | trips of own bookings | own trips | all |
| bookings | own | bookings on own trips | all |
| driver_presence | via `search_trips` / `get_my_active_booking` / realtime broadcast only | own | all |
| trip_events / booking_events | own bookings' events | own trips | all |
| ledger_* | none in V1 | own accounts' entries | all (read) |
| settlements | — | own | all |
| issues | own raised | own raised / about own trips | all |
| platform_settings | via public function | via public function | read/write |

`service_role` is used **only** by server-side code (Next.js server actions on Vercel, Edge Functions) and never shipped to mobile or browser bundles.

Realtime: private channels `trip:<trip_id>` authorised by RLS policies on `realtime.messages`. Only the trip's driver, passengers with an occupying booking on it, and admins can join. Passenger search-list updates use a periodic refetch of `search_trips` (every ~15 s) plus pull-to-refresh, rather than exposing all drivers' positions on a public channel.

---

## 8. Scheduled jobs (pg_cron)

| Job | Schedule | Action |
|---|---|---|
| `sweep_unreachable_drivers` | every minute | suspend `OPEN`/`BOARDING` trips with occupying bookings whose driver is unseen ≥ intervention threshold; auto-cancel empty stale `OPEN` trips; raise one SYSTEM issue per outage (including `IN_PROGRESS`) |
| `expire_pending_holds` | every minute | future prepaid flow; no-op in V1 |
| `flag_stuck_trips` | every 15 min | `IN_PROGRESS` > 3 h → SYSTEM issue `TRIP_STUCK` (threshold configurable) |
