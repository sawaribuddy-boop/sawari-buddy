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

Tooling: **pnpm workspaces** (Expo's monorepo support works with pnpm; `node-linker=hoisted` in `.npmrc` avoids Metro resolution issues). No Turborepo in V1: plain `pnpm -r` scripts are enough.

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
| Location | `expo-location` | foreground in V1 (A12) |
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

Development runs on **Expo Go** for Phase 3–4 screens (foreground location works there). A **development build** (`expo-dev-client`) is needed once background location or other native config is added.

### 3.4 Driver location loop (foreground)
```
Go Online ─► open_trip RPC ─► start expo-location watch (interval = settings.location_update_interval_seconds)
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
| local | `supabase start` (Docker/Colima, already running on this Mac) | Expo Go / dev build pointing at LAN IP | `next dev` |
| staging | Supabase project "sawari-buddy-staging" | EAS `preview` profile (internal APK + TestFlight) | Vercel preview |
| production | Supabase project "sawari-buddy-prod" | EAS `production` → Play Store + App Store | Vercel production |

Env vars (names only, in `.env.example`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (admin server only). Anything prefixed `EXPO_PUBLIC_`/`NEXT_PUBLIC_` is public by design; the service role key must never carry those prefixes.

Local toolchain found on this Mac: Node 25.9 (via nvm, **not LTS**; recommend Node 22/24 LTS for Expo compatibility), npm 11, pnpm 11.18, Supabase CLI 2.98 (update available), Docker via Colima (running). Xcode is **not installed** (only Command Line Tools), so it's needed for the iOS Simulator; alternatively test on a physical iPhone via Expo Go / EAS builds. Android Studio is not installed, so it's needed for the Android emulator; alternatively test on a physical Android phone.

## 8. Testing strategy
- **pgTAP** (`supabase test db`): RLS per role, every allowed/forbidden state transition, ledger zero-sum, idempotency.
- **Concurrency test** (Node script against local Supabase): 20 parallel `book_seats` on a 1-seat-left trip → exactly 1 success; mixed walk-in + app race.
- **Unit tests** (Vitest) for `packages/domain`.
- Mobile/admin: component tests where logic exists; manual device QA on one Android and one iPhone per phase.
