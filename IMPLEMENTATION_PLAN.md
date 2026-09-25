# SawariBuddy — Implementation Plan

Goal: a correctly engineered **mobile MVP (Android + iOS)** with a thin admin back-office. Backend correctness comes first, because the apps are only as reliable as the booking engine underneath them.

Each phase ends with passing tests, a commit/PR, and your approval before the next phase starts.

| Phase | Scope | Status |
|---|---|---|
| **0** | Discovery & design | ✅ approved with 4 adjustments (PROJECT_SPEC §12) |
| **1** | Monorepo, Node 22, app skeletons, shared packages, Supabase schema, booking engine, walk-ins, no-shows, presence/heartbeat, ledger foundations, RLS, seed, tests | ✅ implemented, **awaiting your approval** |
| **2** | Backend completion: settlements + adjustments, admin RPCs, realtime client verification, backend hardening | not started |
| **3** | Mobile: auth + **passenger** flow (Android + iOS) | not started |
| **4** | Mobile: **driver** flow (Android + iOS), foreground location | not started |
| **5** | Admin web (Next.js) | not started |
| **6** | Hardening & release: hosted Supabase (SawariBuddy account), EAS builds → TestFlight + Play internal testing, Vercel | not started |

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

## Phase 2: backend completion (proposed)

Presence, heartbeat, the sweep and ledger postings were pulled into Phase 1, so Phase 2 is smaller:
1. **Cash settlements:** a `settlements` table plus `record_settlement` (admin records the driver paying the platform its fees), posting `SETTLEMENT` ledger lines.
2. **Adjustments:** `post_adjustment` (admin, mandatory reason) and `reverse_transaction` (a reversing entry that references the original).
3. **Admin RPCs:** register/verify/suspend a driver, assign/revoke autos, resolve/close issues, admin cancel of a suspended trip (already possible), dashboard stats.
4. **Stuck trips:** a `flag_stuck_trips` job (`IN_PROGRESS` longer than a configurable limit → `TRIP_STUCK` issue).
5. **Realtime check:** a client-side end-to-end test with supabase-js subscribing to `trip:<id>`, to verify authorisation and event delivery through the real Realtime server.
6. **Advisors:** run the Supabase security and performance advisors against the local schema and fix any findings.

## Phase 3: mobile passenger (outline)
- **Foundation:** expo-router, a Supabase client with SecureStore session storage, auth screens (email + password for development), and routing by role.
- **Booking flow:** route search → results with live seat counts and straight-line distance → confirm (with an idempotency key per tap) → booking tracking via `trip:<id>` → cancel.
- **Also:** history, raising an issue, and testing on a physical Android phone and iPhone via Expo Go.

## Phase 4: mobile driver (outline)
- **Home:** driver home (auto, route, today's earnings) and Go Online / Offline.
- **Location:** the **foreground** location loop, with keep-awake and an offline banner.
- **Current trip:** seat bar, app bookings, **+ Add Walk-in**, Boarded, Final call, No-show with a countdown from `no_show_eligible_at`, Start / Complete / Cancel, and Resume after a suspension.
- **Earnings:** the earnings screen.

## Phase 5: admin web (outline)
- **Foundation:** `@supabase/ssr`, a server-side admin guard, CRUD screens (drivers, autos, assignments, stops, routes).
- **Operations:** trips and bookings views, suspended-trip resolution, the issues queue.
- **Money and settings:** ledger, settlements, the settings editor, dashboard stats.

## Phase 6: release (outline)
- **Hosting:** Supabase staging + production projects under the **SawariBuddy Supabase account**, with migrations applied via CI.
- **Mobile release:** EAS project + `eas.json` profiles, icons/splash, store listings, and a privacy policy (foreground location use). Distribute through TestFlight and the Play internal track.
- **Admin release:** Vercel deploy.
- **Launch readiness:** switch auth to phone OTP (A2), and a regulatory review before any prepaid or wallet feature.
