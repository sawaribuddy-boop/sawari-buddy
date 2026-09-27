# SawariBuddy — Implementation Plan

Goal: a correctly engineered **mobile MVP (Android + iOS)** with a thin admin back-office. Backend correctness comes first, because the apps are only as reliable as the booking engine underneath them.

Each phase ends with passing tests, a commit/PR, and your approval before the next phase starts.

| Phase | Scope | Status |
|---|---|---|
| **0** | Discovery & design | ✅ approved with 4 adjustments (PROJECT_SPEC §12) |
| **1** | Monorepo, Node 22, app skeletons, shared packages, Supabase schema, booking engine, walk-ins, no-shows, presence/heartbeat, ledger foundations, RLS, seed, tests | ✅ approved, merged to `main` |
| **2** | **Mobile app (Android + iOS): foundation, auth, passenger flow, driver flow**, connected to the real local database (Option A) | ✅ approved, merged to `main` |
| **3** | Admin web (Next.js) + admin backend: staging, settlements, adjustments, driver onboarding, admin audit | ✅ approved, merged to `main` |
| **4** | Hardening & release: hosted Supabase (SawariBuddy account), EAS builds → TestFlight + Play internal testing, Vercel | not started |
---

## Phase 1: delivered

### Repository & tooling
- **Node and package manager:** Node 22 LTS (`.nvmrc`, `engines`, `engine-strict`), and pnpm 10.34.5 via Corepack with a hoisted node-linker.
- **Language and CLI:** TypeScript 6.0 strict, and Supabase CLI 2.118 pinned as a devDependency.
- **Test runner:** root `vitest.config.ts` with two projects, `unit` (packages) and `concurrency` (database).
- **Environment:** `.env.example`, with variable names and local defaults only, no secrets.

### Apps (skeletons only, no production UI)
- **`apps/mobile`**: Expo SDK 57 / React Native 0.86, from the official blank TypeScript template.
  - Identifiers: `com.sawaribuddy.app` for both iOS and Android.
  - Builds verified: `expo export` produces **Android and iOS** bundles, and `expo-doctor` passes 21/21 checks.
- **`apps/admin`**: Next.js 16.3 App Router. `next build` succeeds.

### Shared packages
- `@sawari/constants`: enums, error codes → messages.
- `@sawari/types`: generated `Database` types + aliases (`pnpm db:types`).
- `@sawari/domain`: haversine, distance/₹ formatting, fare-split preview, derived availability, countdown. Covered by unit tests.
- `@sawari/validation`: zod schemas for RPC inputs, used for UX only.

### Database (7 migrations): see DATABASE_DESIGN.md
- **Schema:** schemas, enums, identity, fleet, network, settings, trips, bookings, presence, audit, issues, ledger.
- **RPCs:** the trip lifecycle, bookings, walk-ins, no-shows, heartbeat, go offline, resume, issues, reads and earnings.
- **Safety nets:** table-level transition guards, a capacity backstop trigger, and audit triggers.
- **Access:** RLS on every table, locked-down privileges, and Realtime private channel authorisation with broadcast triggers.
- **Jobs:** the pg_cron unreachable-driver sweep.

### Seed (local only)
- 1 admin, 3 drivers, 3 passengers, 3 autos, 4 stops and 4 routes, using names from the UI concept.
- Every seeded account's password is `SawariDev#2026`.

### Tests (Phase 1)
- pgTAP, 5 files, 161 assertions.
- Concurrency (Vitest), 3 tests.
- Domain unit tests, 10.

### Tests (Phase 2 cumulative)
- pgTAP, 7 files, 208 assertions.
- Concurrency (Vitest), 3 tests.
- Vitest unit, 16 files, 119 tests (domain, routing, queryKeys, auth errors, API wrappers, period picker).
- Integration, 2 files (earnings period, booking).

### Tests (Phase 3 cumulative)
- pgTAP, 8 files, 215 assertions (+1 file, +7 assertions for admin_cancel_booking).
- Concurrency (Vitest), 3 tests.
- Vitest unit, 16 files, 119 tests.
- Integration, 2 files.

---

## Phase 2: mobile app (approved)

Decisions:
- **D1** both flows together;
- **D2** local Mac Supabase over the same Wi-Fi first (stop and report before switching to hosted);
- **D3** Expo Go;
- **D4** encrypted session storage;
- **D5** styled placeholders for brand artwork;
- **D6** the dev driver simulator, plus physical phones;
- **D7** English only.

| Step | Scope | Status |
|---|---|---|
| 1 | Expo Router foundation, theme, base components, `(auth)` route group shell, Welcome screen, dev design preview | ✅ done |
| 2 | Supabase client + phone ↔ Mac connectivity (LAN), dev diagnostics | ✅ done |
| 3 | Auth (sign up / log in / sign out, encrypted session), role-protected `(passenger)` / `(driver)` groups | ✅ done |
| 4 | Read-RPC migration (booking history/detail), pgTAP, realtime end-to-end test, regenerated types | ✅ done |
| 5 | Passenger flow (search, available autos, idempotent booking, live status, cancel, history, issues) | ✅ done |
| 6 | Driver flow (foreground heartbeat, trip management, walk-ins, start / complete, resume, earnings) | ✅ done |
| 7 | Earnings period picker, offline / unreachable banners, keep-awake, driver simulator, infra fixes | ✅ done |
| 8 | Mobile unit tests, QA checklist, docs, PR | ✅ done |

Out of scope: admin work, settlements, background location, push notifications, maps/ETA/ratings/seat numbers, payments/wallet/refunds, phone OTP, EAS/stores.

## Phase 3: admin web + staging

| Step | Scope | Status |
|---|---|---|
| 0 | Staging environment: hosted Supabase, push migrations, seed, env files, verify connectivity | ✅ done |
| 1 | Admin foundation: @supabase/ssr, server-side auth guard, layout, login page | ✅ done |
| 2 | Reference data CRUD: stops, routes | ✅ done |
| 3 | Driver onboarding + fleet: invite flow, verify, suspend, autos, assignments | ✅ done |
| 4 | Operations: trips, bookings, passengers, admin RPCs (admin_cancel_booking) | ✅ done |
| 5 | Issues queue | ✅ done |
| 6 | Settlements, adjustments, ledger views + RPCs | ✅ done |
| 7 | Settings, dashboard, admin_actions audit table | ✅ done |
| 8 | Tests, staging QA, docs, PR | ✅ done |

## Phase 4: release (outline)
- **Hosting:** Supabase staging + production under the **SawariBuddy Supabase account**, with migrations applied via CI.
- **Mobile release:** an EAS project (SawariBuddy Expo account), icons/splash from the final brand assets, store listings, and a privacy policy (foreground location). Distribute through TestFlight and the Play internal track.
- **Admin release:** Vercel deploy.
- **Launch readiness:** switch auth to phone OTP (A2), and a regulatory review before any prepaid or wallet feature.
