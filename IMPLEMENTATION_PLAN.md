# SawariBuddy — Implementation Plan

Goal: a correctly engineered **mobile MVP (Android + iOS)** with a thin admin back-office. Backend correctness comes first, because the apps are only as reliable as the booking engine underneath them.

Each phase ends with a demo, passing tests, a commit/PR, and your approval before the next phase starts.

| Phase | Scope | Outcome |
|---|---|---|
| **0** | Discovery & design (this) | Specs, DB design, state machines, plan ✅ |
| **1** | Monorepo + Supabase schema + booking engine + tests | Seat/booking/trip logic proven under concurrency, no UI |
| **2** | Presence, heartbeat, unreachable sweep, realtime channels, ledger postings, earnings | Full backend feature set proven by tests |
| **3** | Mobile: auth + **passenger** flow (Android + iOS) | Passenger can search, book, track, cancel, view history on real phones |
| **4** | Mobile: **driver** flow (Android + iOS) | Driver can go online, share location, manage walk-ins/boarding/no-shows, run trips, see earnings |
| **5** | Admin web (Next.js) | Ops can manage fleet, routes, trips, bookings, issues, ledger, settings |
| **6** | Hardening & release | Staging/prod Supabase, EAS builds → TestFlight + Play internal testing, Vercel deploy, monitoring, launch checklist |

---

## Phase 1: exact plan

**No UI. No app dependencies. Deliverable: a local Supabase database where the booking engine is proven correct by automated tests.**

### 1.1 Repository scaffolding
1. `.nvmrc` pinning Node **22 LTS or 24 LTS** (your approval: Q4), `package.json` (pnpm workspaces, private), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `.npmrc` (`node-linker=hoisted`), `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
2. `.env.example` (names only). Confirm `.gitignore` covers `.env*`.
3. `packages/constants`: booking/trip/driver enums and error codes as `as const` objects + types.
4. `packages/types`: script `pnpm db:types` → `supabase gen types typescript --local > packages/types/src/database.ts`.
5. `packages/domain`: `haversineMeters()`, `formatApproxDistance()`, `splitFare()` preview (mirrors SQL, used for display only), with Vitest tests.
6. `packages/validation`: zod schemas for RPC inputs (`bookSeatsInput`, `addWalkInInput`, …).
7. Dev dependencies only: `typescript`, `vitest`, `zod`, `supabase` CLI (as devDependency, pinned), `pg` (for concurrency test). Nothing else.

### 1.2 Supabase project (local)
1. `supabase init` → `supabase/config.toml`; enable `pg_cron` (used in Phase 2).
2. Migrations, one concern each, in order:
   - `0001_enums.sql`: all enums.
   - `0002_identity.sql`: `profiles`, `drivers`, auth-user trigger, role-protection trigger, helper functions `auth_user_role()`, `is_admin()`.
   - `0003_fleet_network.sql`: `autos`, `auto_assignments`, `stops`, `routes`.
   - `0004_settings.sql`: `platform_settings` (single row, defaults from PROJECT_SPEC §7), `settings_events`.
   - `0005_trips_bookings.sql`: `trips`, `bookings`, `booking_code_seq`, all partial unique indexes and check constraints, `trip_events`/`booking_events` + audit triggers.
   - `0006_presence.sql`: `driver_presence` table (heartbeat function comes in Phase 2; Phase 1 tests set `last_seen_at` directly as a fixture).
   - `0007_trip_functions.sql`: `open_trip`, `final_call`, `start_trip`, `complete_trip` (status part only; ledger in Phase 2), `cancel_trip`, `go_offline`.
   - `0008_booking_functions.sql`: `book_seats`, `cancel_booking`, `add_walk_in`, `remove_walk_in`, `mark_boarded`, `mark_no_show`.
   - `0009_read_functions.sql`: `trip_occupancy` view, `search_trips`, `get_my_active_booking`, `get_platform_settings_public`.
   - `0010_rls.sql`: enable RLS on every table, policies per DATABASE_DESIGN §7, revoke direct writes on `trips`/`bookings`/`driver_presence`.
3. `supabase/seed/seed.sql`: dev-only: 1 admin, 2 drivers, 3 passengers (known test passwords, **local only**), 2 autos (capacity 5 and 4), 4 stops, 3 routes (Station 1 → Dream City ₹30, etc., from the concept).

### 1.3 Tests (must all pass to finish Phase 1)
`supabase/tests/*.sql` (pgTAP):
- **Occupancy:** capacity 5, 2 app + 1 walk-in → available = 2; after no-show → 3; after cancel → +seat_count.
- **Booking guards:** not `OPEN` → `TRIP_NOT_BOOKABLE`; stale driver → `DRIVER_UNREACHABLE`; seat_count > max → `SEAT_COUNT_INVALID`; second active booking → `ALREADY_HAS_ACTIVE_BOOKING`.
- **Idempotency:** same key twice → one row, same id returned.
- **State machine:** every allowed transition succeeds; a representative set of forbidden ones raise `INVALID_TRANSITION` (e.g. cancel after `BOARDED`, no-show before grace, start trip with `WAITING` passengers, driver cancelling an `IN_PROGRESS` trip).
- **Snapshots:** changing auto capacity / route fare / commission after booking doesn't change existing trip/booking values.
- **Uniqueness:** one active trip per driver and per auto.
- **RLS:** passenger A can't read passenger B's bookings; driver can't read another driver's trip; passenger can't `UPDATE bookings` directly; non-admin can't change `profiles.role`.
- **Audit:** each transition writes exactly one `booking_events`/`trip_events` row.

`supabase/tests/concurrency/book-last-seat.test.ts` (Vitest + `pg`, against local DB):
- 20 concurrent `book_seats` by 20 passengers on a trip with 1 seat left → exactly **1** success, 19 `NO_SEAT_AVAILABLE`, final occupied = capacity.
- Race `add_walk_in` vs `book_seats` for the last seat → exactly 1 success.
- 10 concurrent calls with the **same** idempotency key → exactly 1 booking.

### 1.4 Done criteria
- `pnpm typecheck`, `pnpm test`, `supabase test db`, and `supabase db reset` (migrations + seed from scratch) all pass.
- Generated DB types committed.
- DATABASE_DESIGN.md updated for any deviation.
- Committed on branch `phase-1/booking-engine`, PR opened for review.

### Out of Phase 1
Heartbeat RPC, pg_cron sweep, realtime broadcast, ledger tables & postings, earnings, issues, all UI.

---

## Phase 2: backend completion (outline)
`driver_heartbeat` (throttle + `realtime.send`), realtime auth policies, `sweep_unreachable_drivers` + `resume_trip` + cron schedule, issues table + `raise_issue`, ledger tables/invariants/`complete_trip` postings, `record_settlement`, `post_adjustment`, earnings functions; tests for each (including ledger zero-sum and double-completion idempotency).

## Phase 3: mobile passenger (outline)
Expo app scaffold (expo-router, TypeScript strict), Supabase client with SecureStore session, auth screens, role routing, route search → results (live seat counts, distance) → confirm → booking tracking via `trip:<id>` → cancel → history → raise issue. Tested on a physical Android phone and iPhone via Expo Go.

## Phase 4: mobile driver (outline)
Driver home (auto, route, earnings), Go Online/Offline, location loop + keep-awake + offline banner, current-trip screen (seat bar, app bookings, **+ Add Walk-in**, Boarded, Final call, No-show with countdown, Start/Complete/Cancel), earnings screen.

## Phase 5: admin web (outline)
Next.js + `@supabase/ssr`, admin guard, CRUD screens, trips/bookings views, suspended-trip resolution, issues queue, ledger/settlements, settings editor, dashboard stats.

## Phase 6: release (outline)
Supabase staging + prod projects, migrations via CI, EAS project + `eas.json` profiles, app icons/splash, store listings, privacy policy (location use), TestFlight + Play internal track, Vercel deploy, error monitoring (Sentry optional, to be approved), phone OTP switch-over (A2), wallet/regulatory review of the credit ledger before any prepaid feature.

---

## Open questions for approval before Phase 1

| # | Question | My recommendation |
|---|---|---|
| Q1 | Approve assumptions A1–A15 in PROJECT_SPEC §11? | Yes as written |
| Q2 | `WAITING` = "at final call, no-show timer running" (not a waitlist)? | Yes |
| Q3 | Auth for development: email + password now, phone OTP before launch? | Yes |
| Q4 | Pin Node 22 LTS or 24 LTS (you have 25.9, non-LTS)? | Node 22 LTS, the safest for Expo today; can install alongside via nvm |
| Q5 | Seed data city/stops, or should I use the concept's names (Station 1, Dream City, Gaur City, Techzone)? | Concept names for dev |
| Q6 | Do you already have Apple Developer and Google Play Console accounts? | Needed by Phase 6, not before |
