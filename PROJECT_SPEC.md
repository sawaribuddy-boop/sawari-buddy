# SawariBuddy — Product Specification (V1)

> Status: **Approved (Phase 0), with the four adjustments listed in §12. Phase 1 implemented.** Items marked **[ASSUMPTION]** are listed in §11.
>
> Companion docs: [ARCHITECTURE.md](ARCHITECTURE.md) · [DATABASE_DESIGN.md](DATABASE_DESIGN.md) · [STATE_MACHINES.md](STATE_MACHINES.md) · [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
>
> Visual reference: [docs/reference/ui-concept.png](docs/reference/ui-concept.png) (concept, not a pixel spec).

---

## 1. Product summary

SawariBuddy connects passengers with **shared-auto** drivers. A shared auto runs a fixed corridor (e.g. *Station 1 (Metro) → Dream City*), carries up to N passengers, and departs from a stand when the driver decides to go. Passengers either **book a seat in the app** or **walk up from the road**. Both kinds occupy real seats, and the system must know about both.

Three surfaces, one backend:

| Surface | Users | Tech |
|---|---|---|
| Mobile app (single codebase, role-based) | Passenger, Driver | Expo / React Native / TypeScript (Android + iOS) |
| Admin web dashboard | Admin | Next.js / TypeScript (Vercel) |
| Backend | — | Supabase (Postgres, Auth, Realtime, Edge Functions, Storage, pg_cron) |

## 2. The core problems V1 must get right

1. Real-time driver availability (online / unreachable).
2. Latest driver location, updated periodically.
3. App bookings **and** walk-in passengers sharing one capacity.
4. Seat capacity that can never be oversold, even under concurrent booking.
5. Passenger no-shows with a configurable grace period.
6. Driver phone going offline mid-trip or before a trip.
7. Trip lifecycle.
8. An auditable financial ledger (no mutable balances).
9. Driver earnings and settlement balance.

UI polish is secondary to all of the above.

## 3. Reference image — what we take, what we change

| Concept screen | Keep | Change for V1 & why |
|---|---|---|
| P1 Splash / Welcome | Branding, "Get Started", "Login" | — |
| P2 Select route (From / To / Passengers / Popular routes) | From/To selection from **known stops**, seat stepper, route list with fare | From/To are picked from the admin-managed stop list (no free-text geocoding: no Maps API). |
| P3 Available autos ("Arriving in 4 min", rating 4.7) | Auto number, seats available, driver first name, fare/seat, Book Seat | **"Arriving in X min" → "≈ 1.2 km away"** (straight-line; we have no road ETA). **Ratings dropped from V1** (no rating system yet). |
| P4 Confirm booking (seat preference) | Route, fare, seats, passenger name, Confirm | Seat preference kept as a **non-binding note** to the driver **[ASSUMPTION A6]**. No seat-number assignment. |
| P5 Booking confirmed (#SA1001, View live location, Cancel) | Booking code, auto, driver, Cancel | "ETA 4 minutes" → live straight-line distance. "View live location" → **live distance + last-updated time**, no embedded map **[ASSUMPTION A9]**. |
| D1 Driver home (Offline, earnings, My Auto, Select Route, Go Online) | All | — |
| D2 Online / Looking for passengers | All | "Looking for passengers" = trip is `OPEN` and bookable. |
| D3 Current trip (3/5 filled, Boarded/Waiting/Available rows, Start Trip) | Seat bar, passenger rows with status, Start Trip | **Add "+ Add Walk-in Passenger"** (missing from concept, critical). Seat labels (B1/B2/F1) dropped **[A6]**. Add Mark Boarded / Mark No-show actions. |
| D4 Trip in progress (map, ETA 24 min, End Trip) | End Trip | **No map, no ETA** in V1. Show route, passengers on board, elapsed time. |
| Admin dashboard (totals, bookings chart, recent bookings, Drivers/Autos/Routes/Trips/Bookings/Passengers/Payments/Complaints/Settings) | All sections | "Payments" becomes **Ledger & Settlements** (no payment provider in V1). |

## 4. Roles

**One role per account** in V1: `PASSENGER`, `DRIVER`, or `ADMIN` **[ASSUMPTION A1]**. Driver and admin accounts are created or approved by an admin, and a user cannot pick those roles for themselves.

## 5. Functional requirements

### 5.1 Passenger
1. Sign up / log in (see auth assumption **A2**).
2. Pick **origin stop** and **destination stop** from the stop list (swap button supported). V1 books whole routes only: the pair must match an active route **[ASSUMPTION A3]**.
3. Choose seat count (1 … `max_seats_per_booking`, default 3) **[A5]**.
4. See **bookable trips** on that route: auto registration, driver first name, fare/seat, **available seats (server-computed)**, and approximate straight-line distance to the driver if the passenger shares location.
5. Book → server allocates seats atomically → booking code (e.g. `SA1001`) shown.
6. Track the booking: status, the auto's live distance, and the driver's last-seen time.
7. Cancel while the booking is `CONFIRMED` (i.e., before boarding). No cancellation fee in V1 **[A7]**.
8. View booking history.
9. Raise a complaint about a booking or trip.

### 5.2 Driver
1. Log in (account provisioned by admin).
2. See assigned auto(s) and select one; select an active route.
3. **Go Online** → opens a trip (`OPEN`) for that auto + route. Location sharing starts.
4. See app bookings on the current trip in real time.
5. **+ Add Walk-in Passenger** (seat count, optional label such as "man in blue shirt"): one tap for the common case of 1 seat.
6. Mark a passenger **Boarded**.
7. **Final call**: announces departure, stops new app bookings, and starts the no-show grace timer.
8. Mark a passenger **No-show** (only once the grace period has elapsed).
9. **Start Trip** (only when no app booking is still waiting to board).
10. **Complete Trip** → bookings complete, earnings posted to the ledger.
11. Cancel an `OPEN` / `BOARDING` trip (with reason); affected bookings are cancelled.
12. **Go Offline** (blocked while a trip is active; the driver must complete or cancel it first).
13. View earnings (today / period) and current settlement balance.

### 5.3 Admin
1. CRUD drivers (invite, verify, suspend), autos (registration, capacity), driver↔auto assignments.
2. CRUD stops and routes (fare per seat).
3. View/manage passengers (view, suspend).
4. View all trips and bookings; force-cancel a trip; resolve suspended trips.
5. View ledger, driver earnings, settlement balances; record a settlement; post adjustments (with mandatory reason).
6. Manage complaints / issues, including system-raised "driver unreachable" issues.
7. Edit platform settings (commission, thresholds, grace periods).
8. Dashboard: totals, bookings per day, recent bookings.

## 6. Critical business rules

### 6.1 Occupancy (APP + WALK-IN)
- Every person in the auto is one row in `bookings`, with `source = APP | WALK_IN`. Walk-ins are **created by the driver** and start directly in `BOARDED`.
- A booking **occupies seats** when its status is `CONFIRMED` or `BOARDED`.
- `available_seats = trip.capacity − Σ seat_count of occupying bookings on that trip`.
- There is **no stored seat counter**. Occupancy is always derived from booking rows, inside the same transaction that changes them.
- `trip.capacity` is snapshotted from the auto when the trip opens, so an admin editing the auto later can't affect a running trip.

### 6.2 Booking concurrency
- The client never decides availability. Booking goes through a single database function (`book_seats`) which:
  1. locks the trip row (`SELECT … FOR UPDATE`);
  2. checks the trip is `OPEN` and the driver is **reachable**;
  3. recomputes occupancy from booking rows;
  4. inserts the booking or raises `NO_SEAT_AVAILABLE`.
- Adding a walk-in uses the **same lock**, so a walk-in and an app booking can't both take the last seat.
- **Idempotency:** the client sends an `idempotency_key` (UUID generated once per "Confirm" tap). A retry with the same key returns the original booking instead of creating a second one.
- A passenger may hold **only one active booking at a time** **[A4]** (enforced by a partial unique index).

### 6.3 Booking lifecycle
See [STATE_MACHINES.md](STATE_MACHINES.md). A booking does **not** imply boarding: only the driver's "Boarded" action (or walk-in creation) sets `BOARDED`.

### 6.4 No-show
- The driver taps **Final call**. The trip records `final_call_at = now()` and `no_show_eligible_at = final_call_at + no_show_grace_seconds` (default **300 s**, configurable, snapshotted at final call).
- Passengers still expected to board **remain `CONFIRMED`**. There is no separate waiting state.
- The driver can mark a `CONFIRMED` app booking `NO_SHOW` only when `now() ≥ no_show_eligible_at`. The server rejects earlier attempts (`GRACE_PERIOD_NOT_ELAPSED`), and the driver app can show a countdown from `no_show_eligible_at`.
- `NO_SHOW` releases the seats immediately. Because the trip is in `BOARDING` (closed to new app bookings), a freed seat can be filled by a **walk-in** **[ASSUMPTION A8]**.
- No penalty/fee for no-shows in V1. No-show count per passenger is derivable for later policy.

### 6.5 Driver reachability
- `driver_presence.last_seen_at` is updated by every heartbeat/location call from the driver app.
- **Reachable** = driver is online **and** `now() − last_seen_at ≤ driver_stale_seconds` (default **60 s**). This is computed at read time and never stored, so it can't go stale.
- New app bookings are rejected against an unreachable driver (`DRIVER_UNREACHABLE`), and search hides such trips.
- If the driver stays unseen for `driver_intervention_seconds` (default **600 s**) and the trip has active bookings, a scheduled job:
  - `OPEN`/`BOARDING` trip → `SUSPENDED` (bookings untouched), and a system issue is raised for admin; passengers see "Driver unreachable" and may cancel freely;
  - `IN_PROGRESS` trip → **not** suspended (passengers are physically in the auto); a system issue is raised for admin.
- A driver who comes back can **resume** a suspended trip. An admin can instead cancel it (bookings → `CANCELLED`, reason `DRIVER_UNREACHABLE`). The ledger design supports refunds/reassignment later.

### 6.6 Location
- **Location updates occur only while the driver's app is active (in the foreground).** The driver app sends a heartbeat with location every `location_update_interval_seconds` (default **10 s**, configurable, read from settings) while it is in the foreground **and** the driver is online or on an active trip. It stops when the app is backgrounded or the driver goes offline. Background tracking is not part of V1 (A12).
- Only the **latest** location is stored (one row per driver, updated in place). No per-second history table in V1.
- Location is broadcast over Supabase Realtime to subscribers of that trip only.
- Location freshness (`location_at`) is tracked separately from heartbeat (`last_seen_at`): a phone can have network but no GPS fix.

### 6.7 Distance
- Straight-line (haversine) distance between the passenger's device location and the driver's latest location, computed **on the passenger's device**. The passenger's location is **not sent to the server** in V1.
- Displayed as "≈ 1.2 km away (straight line)", never as road distance or ETA.
- If the driver location is older than `driver_stale_seconds`, show "Location last updated 3 min ago".

### 6.8 Money
- All amounts are **integer paise** (`bigint`), INR only.
- Fare is per seat, per route. The fare and platform fee are **snapshotted onto the booking** at booking time, so later changes to route fare or commission don't affect existing bookings.
- `platform_fee = round(fare × commission_bps / 10000)`; `driver_earning = fare − platform_fee`. `commission_bps` is a single configurable setting (default **1000 bps = 10%**, e.g. ₹40 → ₹4 fee → ₹36 driver).
- **V1 payment method is CASH to the driver** **[ASSUMPTION A10]**. No payment gateway.
- Ledger postings happen at **trip completion**, one transaction per completed booking. Balances are derived by summing ledger entries; nothing is stored as a mutable balance.
- With cash, the driver already holds the fare, so their settlement balance is typically **negative** (they owe the platform its fee). Admin records settlements.
- Walk-in fares are recorded for driver earnings; walk-in commission uses a separate setting `walk_in_commission_bps` (default **0**) **[ASSUMPTION A11]**.
- **V1 is cash-only.** No Razorpay/Stripe, no wallet top-ups, no prepaid payments, no refunds.
- `REFUND_CREDIT`, `BOOKING_DEBIT`, `SETTLEMENT` and the `PASSENGER_CREDIT` / `PAYMENT_CLEARING` / `PLATFORM_CASH` accounts already exist in the ledger model, so prepaid payments, refund credits and digital settlements can be added later without redesign. This is a **platform-credit ledger, not a stored-value wallet**.

## 7. Configurable settings (single `platform_settings` row)

| Setting | Default | Used by |
|---|---|---|
| `commission_bps` | 1000 | fare split for app bookings |
| `walk_in_commission_bps` | 0 | fare split for walk-ins |
| `max_seats_per_booking` | 3 | `book_seats` |
| `no_show_grace_seconds` | 300 | `mark_no_show` |
| `driver_stale_seconds` | 60 | reachability (search, booking) |
| `driver_intervention_seconds` | 600 | suspension job |
| `location_update_interval_seconds` | 10 | driver app |
| `min_location_update_interval_seconds` | 3 | server-side throttle |

## 8. Non-goals for V1
Google Maps / any map SDK, road ETA, routing APIs, payment gateway (Razorpay etc.), stored-value wallet, ratings & reviews, seat-number assignment, intermediate stops / partial-route fares, push notifications (in-app realtime only), trip reassignment, AWS, Redis, microservices, AI services, location history.

## 9. Quality rules
TypeScript strict; no unnecessary `any`; no secrets in git; env vars for configuration; all schema changes via migrations; critical operations validated server-side (DB functions), client validation for UX only; booking transactional and idempotent; ledger append-only and auditable; no duplicated state (derive occupancy, reachability, balances); every assumption documented.

## 10. Edge cases (and how V1 handles them)

| # | Scenario | Handling |
|---|---|---|
| E1 | Two passengers tap Book on the last seat simultaneously | Trip row lock serialises; second gets `NO_SEAT_AVAILABLE`. |
| E2 | Driver adds walk-in while a passenger books the last seat | Same lock; whichever commits second fails. Driver sees "Auto is full". |
| E3 | Passenger double-taps Confirm / network retry | Same `idempotency_key` returns the original booking. |
| E4 | Passenger tries to book two autos at once | Partial unique index: one active booking per passenger. |
| E5 | Passenger books a trip whose driver just lost network | Rejected with `DRIVER_UNREACHABLE` once stale > 60 s; search hides the trip. |
| E6 | Driver unreachable 10+ min with bookings, before departure | Trip → `SUSPENDED`, system issue raised, passengers may cancel; driver can resume or admin cancels. |
| E7 | Driver unreachable during `IN_PROGRESS` | Trip continues; issue raised; driver/admin completes it later. |
| E8 | Driver's phone dies and never returns | Admin resolves the issue: completes or cancels the trip from the dashboard. |
| E9 | Passenger doesn't arrive | Final call → grace → driver marks `NO_SHOW` → seat freed for walk-ins. |
| E10 | Driver tries to mark no-show too early | Rejected by server (`GRACE_PERIOD_NOT_ELAPSED`) with seconds remaining. |
| E11 | Driver tries to start trip while app passengers still waiting | Rejected (`PASSENGERS_PENDING`); must board, no-show, or wait for them to cancel. |
| E12 | Passenger cancels after boarding | Not allowed; they're already in the auto. |
| E13 | Passenger cancels during `BOARDING` | Allowed; seat freed. |
| E14 | Driver goes offline with an active trip | Blocked; must complete or cancel trip. |
| E15 | Driver opens two trips / auto used by two drivers | Partial unique indexes: one active trip per driver and per auto. |
| E16 | Admin reduces auto capacity while a trip is running | Trip uses its snapshotted capacity; new capacity applies to next trip. |
| E17 | Admin changes fare/commission mid-trip | Existing bookings keep snapshotted fare/fee. |
| E18 | GPS unavailable but network OK | Heartbeat still updates `last_seen_at`; location shows as stale; bookings still allowed. |
| E19 | Location spam / client sends every 100 ms | Server throttles updates closer than `min_location_update_interval_seconds`. |
| E20 | Client clock is wrong | All timing uses DB `now()`; client timestamps are informational only. |
| E21 | Trip completed twice (retry) | `complete_trip` is idempotent via state check; ledger transactions have unique idempotency keys per booking. |
| E22 | Walk-in gets off before departure | Driver removes walk-in (→ `CANCELLED`), seat freed. |
| E23 | Passenger sees stale seat count in list | UI is advisory; booking re-checks under lock. Realtime refreshes counts. |
| E24 | Suspended driver/auto | Cannot open trips; search excludes them. |
| E25 | Admin needs to correct a wrong ledger posting | Never edit/delete; post an `ADJUSTMENT` transaction with a reason. |
| E26 | App backgrounded by driver during trip | V1 is foreground-only location **[A12]**: heartbeats stop, so after 60 s the driver counts as unreachable (no new bookings) and after 10 min the trip is suspended if pre-departure. Mitigated by keeping the screen awake on the driver trip screen; **Resume trip** on return. |

## 11. Assumptions requiring approval

| ID | Assumption | Alternative |
|---|---|---|
| A1 | One role per account (passenger OR driver OR admin). | Multi-role accounts. |
| A2 | Auth: **email + password (or email OTP)** for development; **phone OTP** added before launch, since it needs an SMS provider (e.g. Twilio via Supabase Auth). | Phone OTP from day one (needs SMS provider account now). |
| A3 | Routes are fixed origin→destination; bookings are for the whole route. No intermediate stops. | Route stops + segment fares (later). |
| A4 | A passenger can hold only one active booking at a time. | Allow multiple. |
| A5 | One booking can reserve 1–3 seats (booking for companions); configurable. | Always 1 seat. |
| A6 | Seat preference (Any / Back / Front) is stored as a non-binding note to the driver; no seat numbers. | Seat map with assignment. |
| A7 | Passenger cancellation is free before boarding. | Cancellation fee / cutoff. |
| A8 | After Final call the trip stops accepting **app** bookings; freed seats go to walk-ins. | Keep app bookings open during boarding. |
| A9 | No map in V1; "live location" = live straight-line distance + freshness. Optionally a button to open the device's native maps app at the driver's coordinates (plain URL, no SDK/API key). | Embedded OpenStreetMap view (still no Google). |
| A10 | V1 payment = cash to driver; ledger records it. | Wait for gateway before launch. |
| A11 | Walk-in fares are recorded for driver earnings with 0% platform commission by default. | Charge commission on walk-ins. |
| A12 | **Approved.** Driver location tracking is foreground-only in V1: updates occur while the driver's app is active. Background tracking is a later phase. | — |
| A13 | **Replaced.** No `WAITING` state. Lifecycle is `CONFIRMED → BOARDED → COMPLETED`, plus `CONFIRMED → CANCELLED` and `CONFIRMED → NO_SHOW`. The no-show timer uses trip timestamps `final_call_at` / `no_show_eligible_at`. | — |
| A14 | **Replaced.** No `PENDING` state in V1 (cash-only). A future prepaid flow can add it with `alter type … add value`. | — |
| A15 | Seed data: a few stops/routes around a sample city for development only. | Real stop list from you. |

## 12. Phase 0 approval: adjustments applied

1. **Node.js 22 LTS**, pinned in `.nvmrc` and `package.json` `engines` (see README).
2. **Booking states:** `WAITING` and `PENDING` were removed. Lifecycle: `CONFIRMED → BOARDED → COMPLETED`, `CONFIRMED → CANCELLED`, `CONFIRMED → NO_SHOW`. The no-show grace uses `trips.final_call_at` and `trips.no_show_eligible_at`.
3. **Driver location** is foreground-only. Updates occur while the driver's app is active; no background tracking.
4. **Payments** are cash-only. No payment provider, wallet top-ups, prepaid payments or refunds; the ledger stays extensible for them.
