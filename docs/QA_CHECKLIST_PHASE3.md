# Phase 3 QA Checklist

Manual testing checklist for the SawariBuddy admin dashboard. Run through each section before merging.

## Prerequisites

- [ ] Local Supabase running (`supabase status` shows API/DB/Auth URLs)
- [ ] `apps/admin/.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Database seeded with test accounts (`supabase db reset`)
- [ ] Seed password for all accounts: `SawariDev#2026`

## Staging

- [ ] `supabase link --project-ref ekksgsfoupstdvhhqsmq` succeeds
- [ ] `supabase db push` applies all 12 migrations without errors
- [ ] Staging health check: `get_server_status` returns `{ ok: true }`
- [ ] Auth works on staging: can sign in with seeded accounts
- [ ] `pnpm mobile:env:staging` switches mobile app to staging

## Auth & Guard

### Login
- [ ] Navigating to `/` when not logged in redirects to `/login`
- [ ] Login with admin account (admin@sawaribuddy.local) succeeds and redirects to dashboard
- [ ] Login with a passenger account shows "Access denied. Admin accounts only."
- [ ] Login with a driver account shows "Access denied. Admin accounts only."
- [ ] Login with wrong password shows "Invalid email or password."
- [ ] Already logged-in admin visiting `/login` redirects to `/`

### Sign Out
- [ ] Click "Sign out" in sidebar → redirects to `/login`
- [ ] After sign out, navigating to `/` redirects to `/login`

## Dashboard

- [ ] Dashboard shows cards: Drivers, Passengers, Trips, Open issues
- [ ] Counts match the seeded data (3 drivers, 3 passengers, 0 trips, 0 issues)

## Stops CRUD

- [ ] `/stops` lists all 4 seeded stops with name, lat, lng, active status
- [ ] Add a new stop with valid data → appears in the list
- [ ] Add a stop with missing name → shows validation error
- [ ] Edit a stop (click Edit, change name, Save) → updates in list
- [ ] Toggle active/inactive → status badge changes

## Routes CRUD

- [ ] `/routes` lists all 4 seeded routes with origin, destination, fare, order
- [ ] Add a new route → appears in the list with correct fare display
- [ ] Add a route with same origin and destination → shows validation error
- [ ] Edit a route fare → updates in list
- [ ] Toggle active/inactive → status badge changes

## Drivers

- [ ] `/drivers` lists all 3 seeded drivers with name, email, license, status
- [ ] All seeded drivers show as "Active"
- [ ] Suspend an active driver → status changes to "Suspended"
- [ ] Reactivate a suspended driver → status changes to "Active"
- [ ] Invite a new driver (requires SUPABASE_SERVICE_ROLE_KEY in .env.local)
  - [ ] Enter email, full name, license number → driver appears in list
  - [ ] New driver starts as "Pending verification"
  - [ ] Verify the new driver → status changes to "Active"

## Fleet

- [ ] `/fleet` shows Autos table and Assignments table
- [ ] All 3 seeded autos listed with registration, model, colour, capacity
- [ ] Add a new auto → appears in the list
- [ ] Edit an auto's details → updates in list
- [ ] Toggle auto active/inactive
- [ ] Assignments section shows all 3 seeded driver-auto assignments
- [ ] Assign a driver to an auto → appears in assignments
- [ ] Revoke an assignment → removed from active assignments

## Trips

- [ ] `/trips` initially shows "No trips yet."
- [ ] After creating a trip (via mobile app or simulator), it appears in the list
- [ ] Trip row shows route, driver, auto, fare, status, date
- [ ] Click "View" → shows trip detail page with info cards
- [ ] Trip detail shows bookings table
- [ ] Admin can cancel an OPEN/BOARDING trip
- [ ] Admin can resume a SUSPENDED trip

## Admin Cancel Booking

- [ ] On trip detail page, CONFIRMED bookings show a "Cancel" button
- [ ] Clicking Cancel changes booking status to CANCELLED
- [ ] Cancel reason shows as ADMIN_CANCELLED
- [ ] BOARDED/COMPLETED/CANCELLED bookings do not show Cancel button

## Issues

- [ ] `/issues` initially shows "No issues."
- [ ] After a passenger raises an issue (via mobile), it appears in the queue
- [ ] "Take" button assigns the issue to the admin (status → IN_REVIEW)
- [ ] "Resolve" shows resolution note input
- [ ] Submitting resolution note → status changes to RESOLVED
- [ ] "Close" a resolved issue → status changes to CLOSED

## Ledger

- [ ] `/ledger` shows Account Balances and Recent Transactions
- [ ] After completing a trip (with bookings), ledger shows PAYMENT entries
- [ ] Record Settlement: select driver, enter amount → transaction appears
- [ ] Record Adjustment: positive and negative amounts both work
- [ ] Adjustment requires a description

## Settings

- [ ] `/settings` shows current platform settings with editable fields
- [ ] Change commission_bps and save → value persists on page reload
- [ ] Invalid values (e.g., negative commission) show validation error
- [ ] Audit log shows the settings update with admin name and timestamp

## Automated Tests

### pgTAP (database)
- [ ] `pnpm db:test` — all database tests pass (8 files, 215 assertions)

### Vitest (unit + concurrency)
- [ ] `pnpm test` — all unit tests pass (16 files, 119 tests)
- [ ] `pnpm test:concurrency` — all concurrency tests pass (3 tests)

### Build Checks
- [ ] `pnpm typecheck` — all 6 workspace projects pass
- [ ] `pnpm --filter @sawari/admin build` — builds without errors
- [ ] All routes render: /, /login, /stops, /routes, /drivers, /fleet, /trips, /issues, /ledger, /settings
