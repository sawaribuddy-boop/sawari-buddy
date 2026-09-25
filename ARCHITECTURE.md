# SawariBuddy — Architecture

> **SawariBuddy is a mobile product.** The primary deliverable is **one Expo / React Native app that ships as native builds to both the Google Play Store (Android) and the Apple App Store (iPhone)**, used by passengers and drivers. The Next.js admin is an internal web back-office for the operations team only.

## 1. System overview

```
┌──────────────────────── Mobile app (Expo, one codebase) ─────────────────────────┐
│  Android (Play Store)                           iOS / iPhone (App Store)         │
│  ┌────────────── Passenger mode ─────────────┐ ┌──────────── Driver mode ──────┐ │
│  │ route search · book · track · history     │ │ go online · trip · walk-ins   │ │
│  │ device GPS (optional) → haversine locally │ │ GPS → heartbeat every 10 s    │ │
│  └───────────────────────────────────────────┘ └───────────────────────────────┘ │
│              supabase-js (anon key + user JWT; never service role)               │
└───────────────────────────────┬──────────────────────────────────────────────────┘
                                │ HTTPS (PostgREST RPC) + WebSocket (Realtime)
┌───────────────────────────────▼──────────────────────── Supabase ────────────────┐
│ Auth (JWT) · Postgres (tables + RLS + SECURITY DEFINER RPCs = business logic)    │
│ Realtime (private channels trip:<id>, postgres changes for driver's trip)        │
│ pg_cron (unreachable-driver sweep) · Edge Functions (only where needed)          │
│ Storage (later: driver documents, auto photos)                                   │
└───────────────────────────────▲──────────────────────────────────────────────────┘
                                │ user JWT (admin role) + server-only service role
┌───────────────────────────────┴──────────────────┐
│ Admin web (Next.js on Vercel), internal staff    │
└──────────────────────────────────────────────────┘
```

**Where business logic lives:** in Postgres functions. The seat check, state transitions, fare split, and ledger postings are all transactional SQL. The apps call RPCs and render results. This keeps a single source of truth that both mobile platforms and the admin share, and it is the only place concurrency can be handled correctly.

**Why not Edge Functions for booking:** an Edge Function would still need a DB transaction with a row lock; doing it in a DB function avoids an extra network hop and a second place to get transactions wrong. Edge Functions are reserved for things SQL can't do (sending SMS/push later, calling payment providers later, admin user invitations if not done from Next.js server actions).

## 2. Monorepo layout

```
sawari-buddy/
├── apps/
│   ├── mobile/                 # Expo app — Android + iOS (passenger & driver)
│   │   ├── app/                # expo-router file-based routes
│   │   │   ├── (auth)/         # welcome, login, signup
│   │   │   ├── (passenger)/    # search, results, confirm, booking, history
│   │   │   └── (driver)/       # home, online/trip, earnings
│   │   ├── src/
│   │   │   ├── features/       # booking/, trip/, presence/, earnings/ — hooks + RPC calls
│   │   │   ├── lib/            # supabase client, secure session storage, location service
│   │   │   └── components/     # presentational UI only
│   │   ├── app.config.ts       # permissions, bundle ids, env
│   │   └── eas.json            # build profiles: development / preview / production
│   └── admin/                  # Next.js (App Router) — internal staff web dashboard
├── packages/
│   ├── types/                  # generated Supabase DB types + domain types
│   ├── validation/             # zod schemas for RPC inputs (client-side UX validation)
│   ├── constants/              # enums (status values), error codes, labels
│   └── domain/                 # pure functions: haversine, fare-split preview, formatters
├── supabase/
│   ├── config.toml
│   ├── migrations/             # all schema, RLS, functions, cron
│   ├── functions/              # Edge Functions (none in Phase 1)
│   ├── seed/                   # dev-only seed SQL
│   └── tests/                  # pgTAP tests (RLS, state machines, concurrency)
├── docs/reference/ui-concept.png
├── package.json                # pnpm workspaces root
├── pnpm-workspace.yaml
├── tsconfig.base.json          # strict: true
└── .env.example                # names only, no values
```

`packages/domain` is one addition to the structure you proposed. It holds pure, platform-free logic that both mobile and admin need (haversine distance, "₹40 → ₹4 fee" preview, time-ago formatting). It must never contain authoritative rules; those stay in SQL.

Tooling (pinned in Phase 1):
- **Node.js 22 LTS**: `.nvmrc` and `package.json` `engines` (`>=22.12 <23`); `engine-strict=true` makes installs fail on other versions.
- **pnpm 10.34.5** via Corepack (`packageManager` field). `node-linker=hoisted` in `.npmrc` avoids Metro resolution issues.
- **TypeScript 6.0** (the version Expo SDK 57 ships with), strict everywhere.
- **Supabase CLI 2.118.0**, as a pinned devDependency (`pnpm exec supabase …`).
- **Expo SDK 57** / React Native 0.86 / React 19.2; **Next.js 16.3**.

No Turborepo in V1: plain `pnpm -r` scripts are enough. Workspace packages ship TypeScript source and are compiled by Metro / Next (`transpilePackages`), so there is no build step.

## 3. Mobile app (Android + iOS)

### 3.1 One app, two modes
- After login the app reads `profiles.role` and routes to the `(passenger)` or `(driver)` stack. A driver never sees passenger screens and vice versa (enforced by RLS, not just navigation).
- Single store listing per platform: **"SawariBuddy"** on Play Store and App Store. (A separate "SawariBuddy Driver" app is a possible later split; one codebase supports either.)

### 3.2 Key libraries (installed in Phase 3, not before)
| Need | Library | Notes |
|---|---|---|
| Navigation | `expo-router` | file-based |
| Backend | `@supabase/supabase-js` | anon key only |
| Session storage | `expo-secure-store` (+ `AsyncStorage` for large values) | tokens in Keychain (iOS) / Keystore (Android) |
| Location | `expo-location` | **foreground only in V1** (A12): updates occur while the driver's app is active |
| Keep screen on during trip | `expo-keep-awake` | mitigates heartbeat loss |
| Server state | `@tanstack/react-query` | caching, retries, refetch on focus |
| Forms/validation | `zod` (from `packages/validation`) | |
| Network status | `@react-native-community/netinfo` | offline banners, pause heartbeats |

No map SDK, no Google services.

### 3.3 Platform specifics

| Topic | Android | iOS (iPhone) |
|---|---|---|
| Location permission | `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` runtime prompt | `NSLocationWhenInUseUsageDescription` with clear purpose text |
| Background location (later, A12) | `ACCESS_BACKGROUND_LOCATION` + foreground service notification; Play Console declaration | `NSLocationAlwaysAndWhenInUseUsageDescription`, `UIBackgroundModes: location`; App Review justification |
| Passenger location | "While using the app" only; optional, and search works without it | same |
| Secure storage | Android Keystore via SecureStore | iOS Keychain via SecureStore |
| Battery/Doze | Heartbeat may pause when backgrounded; server treats as unreachable after 60 s | same, with iOS suspending JS when backgrounded |
| Builds | EAS Build → `.aab` for Play Store, `.apk` for internal testing | EAS Build → `.ipa`, TestFlight for testers (needs Apple Developer account, $99/yr) |
| Store accounts needed | Google Play Console (one-time $25) | Apple Developer Program |

Development runs on **Expo Go** for Phase 3–4 screens (foreground location works there). A **development build** (`expo-dev-client`) is needed only once custom native config is added.

Phase 1 app identifiers: iOS `bundleIdentifier` and Android `package` are both `com.sawaribuddy.app`, and the URL scheme is `sawaribuddy`.

### 3.4 Driver location loop (foreground only)
Location updates occur **only while the driver's app is active in the foreground**. Nothing runs when the app is backgrounded or the screen is locked; the server then treats the driver as unreachable after `driver_stale_seconds`. Background location is out of scope for V1 and needs no extra permissions.
```
Go Online ─► open_trip RPC ─► start expo-location foreground watch (interval = settings.location_update_interval_seconds)
  every tick: driver_heartbeat(lat, lng, accuracy) ─► DB updates driver_presence ─► realtime.send('trip:<id>', 'location', …)
  no GPS fix: driver_heartbeat() with no coords (still proves reachability)
  offline (NetInfo): skip, show "You are offline — passengers can't book you" banner
Go Offline / trip completed with no new trip ─► stop watch
```

### 3.5 Passenger tracking
- Subscribe to private channel `trip:<id>` after booking: receives `location` and `booking_status` events.
- Distance = haversine(passenger device location, driver location), computed on device and re-computed on each location event. "≈ 1.2 km away (straight line)".
- On reconnect/app foreground: refetch `get_my_active_booking()` (realtime is a hint; the DB is the truth).

## 4. Admin web (Next.js on Vercel)
- App Router, server components; Supabase SSR auth (`@supabase/ssr`) with cookies. Every page checks `is_admin` server-side.
- Reads via the admin's own JWT (RLS grants admin access). The **service-role key lives only in Vercel server env** and is used only for auth-admin operations (inviting a driver account).
- Sections mirror the concept: Dashboard, Drivers, Autos, Routes & Stops, Trips, Bookings, Passengers, Ledger & Settlements, Issues, Settings.

## 5. Realtime design
| Channel | Type | Who joins | Events |
|---|---|---|---|
| `trip:<trip_id>` | private broadcast (authorised via RLS on `realtime.messages`) | trip's driver, passengers with an occupying booking, admins | `location`, `booking_changed`, `trip_changed` |
| Driver's current trip bookings | postgres changes on `bookings` filtered by `trip_id` (RLS applies) | driver | new booking, cancellations |

Broadcasts are sent from inside the DB functions (`realtime.send`), so a message is emitted only when the transaction does the change.

## 6. Error contract
DB functions raise stable codes, which `packages/constants` maps to user-facing text:
`NO_SEAT_AVAILABLE`, `TRIP_NOT_BOOKABLE`, `DRIVER_UNREACHABLE`, `ALREADY_HAS_ACTIVE_BOOKING`, `SEAT_COUNT_INVALID`, `GRACE_PERIOD_NOT_ELAPSED`, `PASSENGERS_PENDING`, `ACTIVE_TRIP_EXISTS`, `AUTO_NOT_ASSIGNED`, `INVALID_TRANSITION`, `NOT_AUTHORISED`.

## 7. Environments & configuration
| Env | Supabase | Mobile | Admin |
|---|---|---|---|
| local | `pnpm db:start` (Docker/Colima). SawariBuddy uses ports **55321** (API), **55322** (DB), **55323** (Studio), **55324** (mail), so it can run alongside other local Supabase projects on the default 5432x ports | Expo Go / dev build pointing at the Mac's LAN IP | `pnpm admin` → http://localhost:3100 |
| staging | Supabase project "sawari-buddy-staging" | EAS `preview` profile (internal APK + TestFlight) | Vercel preview |
| production | Supabase project "sawari-buddy-prod" | EAS `production` → Play Store + App Store | Vercel production |

Env vars (names only, in `.env.example`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (admin server only), `SUPABASE_DB_URL` (tests, local only). Anything prefixed `EXPO_PUBLIC_`/`NEXT_PUBLIC_` is public by design; the service role key must never carry those prefixes.

Hosted Supabase projects (staging/production) will be created under the **dedicated SawariBuddy Supabase account**, never a personal account. Until Phase 6 everything runs locally, and no cloud project is linked.

This Mac has no Xcode (only Command Line Tools), so there's no iOS Simulator; test on a physical iPhone via Expo Go, or install Xcode. There's no Android Studio either, so there's no emulator; test on a physical Android phone via Expo Go, or install Android Studio.

## 8. Testing strategy
- **pgTAP** (`pnpm db:test`, files in `supabase/tests/database/`): RLS per role, allowed and forbidden state transitions, no-show grace, presence and sweep, ledger invariants, idempotency.
- **Concurrency tests** (`pnpm test:concurrency`, Vitest + `pg` against the local database):
  - 20 simultaneous `book_seats` calls for 1 remaining seat;
  - walk-in vs app race for the last seat;
  - 10 simultaneous same-key requests.
  
  A separate connection holds the trip lock until Postgres reports every request blocked, so the requests genuinely overlap.
- **Unit tests** (Vitest) for `packages/domain`.
- Mobile/admin: component tests where logic exists; manual device QA on one Android and one iPhone per phase.
