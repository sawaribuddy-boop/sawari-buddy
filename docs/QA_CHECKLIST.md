# Phase 2 QA Checklist

Manual testing checklist for the SawariBuddy mobile app. Run through each section on a physical device or Expo Go before merging.

## Prerequisites

- [ ] Local Supabase running (`supabase status` shows API/DB/Auth URLs)
- [ ] `apps/mobile/.env.local` has correct `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Device/emulator can reach the Mac's LAN IP on port 55321
- [ ] Database seeded with test accounts (`supabase db reset`)
- [ ] Seed password for all accounts: `SawariDev#2026`

## Auth

### Sign Up
- [ ] Create a new passenger account with valid email + password (≥8 chars)
- [ ] Weak password (< 8 chars) shows "Please choose a stronger password"
- [ ] Invalid email format shows "Please enter a valid email address"
- [ ] Duplicate email shows "An account with this email already exists"
- [ ] After sign-up, user lands on the passenger home screen
- [ ] Session persists across app restart (encrypted SecureStore)

### Log In
- [ ] Log in with a seeded passenger account
- [ ] Wrong password shows "Email or password is incorrect" (no email-exists leak)
- [ ] Log in with a seeded driver account → lands on driver home
- [ ] Log in with the admin account → appropriate handling (admin role)

### Sign Out
- [ ] Sign out clears session and returns to Welcome screen
- [ ] After sign out, restarting the app shows Welcome (not a stale home screen)

### Network Errors
- [ ] Disable Wi-Fi, attempt login → "Check your connection and try again"
- [ ] Re-enable Wi-Fi, retry → succeeds

## Passenger Flow

### Search
- [ ] Passenger home screen shows "Find a ride" search interface
- [ ] Select origin and destination stops from the available routes
- [ ] Search returns available trips with correct route, fare, and seat info
- [ ] No results state shown when no trips match

### Booking
- [ ] Book a seat on an available trip
- [ ] Booking confirmation shows trip details (route, driver, fare, seats)
- [ ] Double-tap / rapid re-tap does not create duplicate bookings (idempotent)
- [ ] Booking appears in active booking status view

### Live Status
- [ ] Active booking screen shows current trip state (OPEN, BOARDING, IN_PROGRESS)
- [ ] Status updates in real-time when driver changes trip state (via simulator or second device)
- [ ] Realtime update triggers TanStack Query invalidation (not stale data)

### Cancel Booking
- [ ] Cancel an active booking before the trip departs
- [ ] Cancellation confirmation shown
- [ ] Cancelled booking no longer appears as active
- [ ] Cancelled booking appears in history with CANCELLED status

### Booking History
- [ ] History screen lists past bookings (completed, cancelled)
- [ ] Each entry shows route, date, fare, and status
- [ ] Empty state shown for new accounts with no history

## Driver Flow

### Driver Home
- [ ] Driver home screen shows current status (online/offline)
- [ ] Active trip details shown when a trip is in progress
- [ ] "No active trip" state shown when idle

### Heartbeat & Presence
- [ ] Going online starts foreground heartbeat (visible in Supabase `driver_presence`)
- [ ] Heartbeat interval respects server-returned `next_heartbeat_seconds`
- [ ] Going offline stops heartbeat, sets driver as offline
- [ ] Keep-awake active while driver is online (screen does not dim)
- [ ] Heartbeat is foreground-only — backgrounding the app does not send heartbeats

### Trip Management
- [ ] Start a trip → status changes to IN_PROGRESS
- [ ] Board a passenger → booking status changes to BOARDED
- [ ] Complete a trip → status changes to COMPLETED, all BOARDED bookings complete
- [ ] Walk-in booking works during BOARDING state
- [ ] No-show marking works for confirmed but unboarded passengers

### Passenger Unreachable Warning
- [ ] When a booked passenger's app goes offline, driver sees an unreachable indicator
- [ ] Warning clears when passenger comes back online

## Driver Simulator

- [ ] `pnpm simulate:driver` starts without errors (reads env from `.env.local`)
- [ ] Simulator logs in with env-provided credentials (not hardcoded)
- [ ] Simulator goes online, sends heartbeats, and responds to bookings
- [ ] Passenger app sees the simulated driver's trip as available

## Earnings

### Period Picker
- [ ] "Today" selected by default, shows today's earnings
- [ ] "Yesterday" shows previous day's earnings (IST boundaries)
- [ ] "This Week" shows earnings from Monday to now (IST)
- [ ] "All Time" shows lifetime earnings
- [ ] Switching periods updates the displayed totals
- [ ] Zero-earnings state handled gracefully (₹0, not blank/error)

### Earnings Data
- [ ] Trip count, total fare, and commission shown
- [ ] Values match what the driver actually completed in test scenarios

## Offline & Edge Cases

### Offline Banners
- [ ] Losing network shows an offline banner on passenger screens
- [ ] Losing network shows an offline banner on driver screens
- [ ] Banner dismisses when connectivity returns
- [ ] App does not crash when performing actions offline (graceful error)

### Session Expiry
- [ ] Expired JWT triggers token refresh automatically
- [ ] If refresh fails, user is redirected to login

### Deep Navigation
- [ ] Back button works correctly through the navigation stack
- [ ] No screen flicker or layout jump on role-based redirects

## Platform Checks

### Android
- [ ] App launches on Android device/emulator via Expo Go
- [ ] All flows above work on Android
- [ ] No layout overflow or text truncation on smaller screens

### iOS
- [ ] App launches on iOS device/simulator via Expo Go
- [ ] All flows above work on iOS
- [ ] Safe area insets respected (notch, home indicator)
- [ ] Keyboard does not obscure input fields

## Automated Tests

### Vitest (unit + concurrency)
- [ ] `pnpm test` — all unit tests pass (16 files, 119 tests)
- [ ] `pnpm test:concurrency` — all concurrency tests pass (3 tests)

### pgTAP (database)
- [ ] `pnpm db:test` — all database tests pass (7 files, 208 assertions)

### Build Checks
- [ ] `pnpm typecheck` — all 6 workspace projects pass
- [ ] `npx expo export --platform android` — bundles without errors
- [ ] `npx expo export --platform ios` — bundles without errors
- [ ] `npx expo-doctor` — 21/21 checks pass
