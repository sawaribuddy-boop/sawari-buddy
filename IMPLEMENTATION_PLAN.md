# SawariBuddy — Implementation Plan

Goal: a correctly engineered **mobile MVP (Android + iOS)** with a thin admin back-office. Backend correctness comes first, because the apps are only as reliable as the booking engine underneath them.

Each phase ends with passing tests, a commit/PR, and your approval before the next phase starts.

| Phase | Scope | Status |
|---|---|---|
| **0** | Discovery & design | ✅ approved with 4 adjustments (PROJECT_SPEC §12) |
| **1** | Monorepo, Node 22, app skeletons, shared packages, Supabase schema, booking engine, walk-ins, no-shows, presence/heartbeat, ledger foundations, RLS, seed, tests | ✅ approved, merged to `main` |
| **2** | **Mobile app (Android + iOS): foundation, auth, passenger flow, driver flow**, connected to the real local database (Option A) | 🚧 in progress, Steps 1–2 done |
| **3** | Admin web (Next.js) + admin backend: settlements, adjustments, driver onboarding, stuck-trip job | not started |
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

### Tests
- pgTAP, 5 files, 161 assertions.
- Concurrency (Vitest), 3 tests.
- Domain unit tests, 10.

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
| 3 | Auth (sign up / log in / sign out, encrypted session), role-protected `(passenger)` / `(driver)` groups | next |
| 4 | Read-RPC migration (booking history/detail), pgTAP, realtime end-to-end test, regenerated types | |
| 5 | Driver flow (foreground heartbeat, trip management, walk-ins, final call / no-show, start / complete, resume) | |
| 6 | Passenger flow (search, available autos, idempotent booking, live status, cancel, history, issues) | |
| 7 | Earnings, profiles, offline / unreachable banners, `scripts/dev/simulate-driver.ts` | |
| 8 | Mobile unit tests, optional CI, Android + iPhone QA checklist, docs, PR | |

Out of scope: admin work, settlements, background location, push notifications, maps/ETA/ratings/seat numbers, payments/wallet/refunds, phone OTP, EAS/stores.

## Phase 3: admin web (outline)
- **Foundation:** Next.js + `@supabase/ssr`, a server-side admin guard, CRUD for drivers (onboarding), autos, assignments, stops and routes.
- **Operations:** trips and bookings views, suspended-trip resolution, the issues queue.
- **Money and settings:** cash settlements (`record_settlement`), adjustments / reversals, ledger views, the settings editor, dashboard stats, the `flag_stuck_trips` job.

## Phase 4: release (outline)
- **Hosting:** Supabase staging + production under the **SawariBuddy Supabase account**, with migrations applied via CI.
- **Mobile release:** an EAS project (SawariBuddy Expo account), icons/splash from the final brand assets, store listings, and a privacy policy (foreground location). Distribute through TestFlight and the Play internal track.
- **Admin release:** Vercel deploy.
- **Launch readiness:** switch auth to phone OTP (A2), and a regulatory review before any prepaid or wallet feature.
