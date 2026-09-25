# SawariBuddy — State Machines

> Updated for Phase 1. This document matches what is implemented in `supabase/migrations/`.

All transitions are performed **only** by database functions (RPCs) or the scheduled job. Clients never `UPDATE status` directly: table privileges are revoked. On top of that, a table-level trigger rejects any transition not listed here, whatever code path attempts it. Every transition is logged to `booking_events` / `trip_events` by triggers.

Timing always uses database `now()`, never the phone's clock.

---

## 1. Trip

A trip is one run of one auto, driven by one driver, on one route.

```
                    driver: open_trip (Go Online)
                               │
                               ▼
     ┌──────────────────────  OPEN  ───────────────────────┐
     │  (app bookings + walk-ins allowed)                  │
     │                         │                           │
     │     driver: final_call  │                           │ driver: start_trip
     │  sets final_call_at and │                           │ (no CONFIRMED bookings left,
     │  no_show_eligible_at    ▼                           │  at least one BOARDED)
     │                     BOARDING ───────────────────────┤
     │  (walk-ins only; no-show allowed once               │
     │   now() ≥ no_show_eligible_at)                      ▼
     │                                               IN_PROGRESS
     │                                                     │ driver/admin: complete_trip
     │                                                     ▼
     │                                                COMPLETED (terminal)
     │
     │ driver/admin: cancel_trip  (from OPEN, BOARDING, SUSPENDED)
     └──────────────────────────────►  CANCELLED (terminal)

  OPEN / BOARDING ──(job: driver unseen ≥ driver_intervention_seconds
                     AND trip has seat-occupying bookings)──► SUSPENDED
  SUSPENDED ──(driver: resume_trip)──► previous status (OPEN|BOARDING)
  SUSPENDED ──(driver/admin: cancel_trip)──► CANCELLED
```

| From | To | Actor / function | Guard | Side effects |
|---|---|---|---|---|
| — | `OPEN` | driver `open_trip(auto_id, route_id)` | driver profile + driver record `ACTIVE`; auto `ACTIVE` and assigned to driver; route + both stops active; no active trip for driver or auto | snapshot `capacity`, `fare_paise`; presence `is_online = true`, `active_trip_id`, `last_seen_at = now()` |
| `OPEN` | `BOARDING` | driver `final_call` | — | `final_call_at = now()`; `no_show_eligible_at = now() + no_show_grace_seconds` (snapshotted, so later setting changes don't move it). **Bookings keep their status (`CONFIRMED`).** |
| `OPEN`/`BOARDING` | `IN_PROGRESS` | driver `start_trip` | no `CONFIRMED` bookings (`PASSENGERS_PENDING`); ≥ 1 `BOARDED` (`NO_PASSENGERS_BOARDED`) | `started_at = now()` |
| `IN_PROGRESS` | `COMPLETED` | driver or admin `complete_trip` | — (idempotent: completing a `COMPLETED` trip returns it unchanged) | `BOARDED` bookings → `COMPLETED`; one ledger transaction per booking; presence `active_trip_id = null` |
| `OPEN`/`BOARDING`/`SUSPENDED` | `CANCELLED` | driver `cancel_trip` (reason `DRIVER_CANCELLED`) / admin (`ADMIN_CANCELLED` or `DRIVER_UNREACHABLE`) | — | all seat-occupying bookings → `CANCELLED` (`TRIP_CANCELLED`, or `DRIVER_UNREACHABLE`); presence `active_trip_id = null` |
| `OPEN`/`BOARDING` | `CANCELLED` | driver `go_offline` | trip has **no** occupying bookings | reason `DRIVER_OFFLINE` |
| `OPEN`/`BOARDING` | `CANCELLED` | job `sweep_unreachable_drivers` | driver unseen ≥ intervention threshold; trip has **no** occupying bookings | reason `DRIVER_UNREACHABLE`; driver marked offline |
| `OPEN`/`BOARDING` | `SUSPENDED` | job `sweep_unreachable_drivers` | driver unseen ≥ intervention threshold; trip **has** occupying bookings | `suspended_at`, `suspended_from_status`; one `SYSTEM`/`DRIVER_UNREACHABLE` issue |
| `SUSPENDED` | `OPEN`/`BOARDING` | driver `resume_trip` | — | suspension fields cleared; open unreachable issue auto-resolved |
| `IN_PROGRESS` | *(no change)* | job | driver unseen ≥ intervention threshold | one `SYSTEM`/`DRIVER_UNREACHABLE` issue (de-duplicated) |

Notes
- `IN_PROGRESS → CANCELLED` is not allowed for anyone, because passengers are on board. An admin resolves a stuck trip with `complete_trip`.
- Between `driver_stale_seconds` (60 s) and `driver_intervention_seconds` (600 s), an unreachable driver's trip stays `OPEN`/`BOARDING`. It is hidden from search and new bookings are rejected (`DRIVER_UNREACHABLE`), but nothing is changed. This avoids punishing a short network drop.
- Active statuses (for "one active trip per driver/auto"): `OPEN`, `BOARDING`, `IN_PROGRESS`, `SUSPENDED`.
- `route_id`, `auto_id`, `driver_id`, `capacity`, `fare_paise` and `opened_at` are immutable after creation (`IMMUTABLE_FIELD`).

---

## 2. Booking

Applies to both `APP` and `WALK_IN` sources.

```
   passenger: book_seats ─► CONFIRMED ──── driver: mark_boarded ───► BOARDED ── complete_trip ──► COMPLETED
                               │  │                                     │
                               │  └─ driver: mark_no_show ──► NO_SHOW   └─ cancel_trip (before departure) ─┐
                               │     (trip BOARDING and                   or remove_walk_in (walk-ins)     │
                               │      now() ≥ no_show_eligible_at)                                         ▼
                               └─ passenger: cancel_booking / cancel_trip ────────────────────────────► CANCELLED

   driver: add_walk_in ─► BOARDED ─► COMPLETED
```

A passenger who is waiting to board stays **`CONFIRMED`**, before and after the final call. There is no `WAITING` or `PENDING` state in V1. The no-show timer is expressed entirely by the trip's `final_call_at` / `no_show_eligible_at` timestamps.

| From | To | Actor / function | Guard |
|---|---|---|---|
| — | `CONFIRMED` (APP) | passenger `book_seats` | trip `OPEN`; driver reachable; seats available **under trip row lock**; passenger has no other active booking; `1 ≤ seat_count ≤ max_seats_per_booking`; idempotency key |
| — | `BOARDED` (WALK_IN) | driver `add_walk_in` | trip `OPEN`/`BOARDING`¹; seats available under the same lock; idempotency key |
| `CONFIRMED` | `BOARDED` | driver `mark_boarded` | trip `OPEN`/`BOARDING` (idempotent) |
| `CONFIRMED` | `NO_SHOW` | driver `mark_no_show` | APP booking; trip `BOARDING` (`FINAL_CALL_REQUIRED`); `now() ≥ trip.no_show_eligible_at` (`GRACE_PERIOD_NOT_ELAPSED`) (idempotent) |
| `CONFIRMED` | `CANCELLED` | passenger `cancel_booking` | own booking (idempotent) |
| `BOARDED` (walk-in) | `CANCELLED` | driver `remove_walk_in` | trip `OPEN`/`BOARDING` |
| `CONFIRMED`/`BOARDED` | `CANCELLED` | system, inside `cancel_trip` / sweep | — |
| `BOARDED` | `COMPLETED` | system, inside `complete_trip` | — |

¹ **Walk-ins during `IN_PROGRESS`**: in reality someone can hop on mid-route. V1 only allows `add_walk_in` while the trip is `OPEN` or `BOARDING`, because partial-route fares are out of scope (A3). Flagged for later.

- **Seat occupancy:** `CONFIRMED` and `BOARDED` occupy seats; `COMPLETED`, `CANCELLED` and `NO_SHOW` do not.
- **Terminal states:** `COMPLETED`, `CANCELLED`, `NO_SHOW`.
- **`cancel_reason` values:** `PASSENGER_CANCELLED`, `TRIP_CANCELLED`, `DRIVER_UNREACHABLE`, `WALK_IN_REMOVED`, `ADMIN_CANCELLED`.
- **Immutable after creation:** trip, source, passenger, seat count, fare/fee snapshot, idempotency key, creator and code.

**Future prepaid flow:** add a `PENDING` enum value (`alter type … add value`) for "seat held while paying", with a hold expiry. It would count as occupying only until the hold expires. Nothing else in the machine changes.

---

## 3. Driver availability

Stored (one row per driver in `driver_presence`, updated in place):

- `is_online` (boolean): the driver's **intent**, set by Go Online (`open_trip`) / Go Offline (`go_offline`).
- `active_trip_id`: the current trip, if any.
- `last_seen_at`: last heartbeat of any kind. Every driver RPC also counts as a heartbeat.
- `lat`, `lng`, `accuracy_m`, `location_at`: last known location.

Derived (never stored):

| Derived state | Condition |
|---|---|
| `OFFLINE` | `is_online = false` |
| `ONLINE` (reachable) | `is_online = true` and `now() − last_seen_at ≤ driver_stale_seconds` and driver/profile `ACTIVE` |
| `UNREACHABLE` | `is_online = true` and `now() − last_seen_at > driver_stale_seconds` |
| location fresh / stale / none | from `location_at` vs `driver_stale_seconds` |

```
 OFFLINE ──Go Online (open_trip)──► ONLINE ──no heartbeat > stale──► UNREACHABLE
    ▲                                 │  ▲                               │
    └── Go Offline (no booked trip) ──┘  └────────heartbeat──────────────┘
                                          UNREACHABLE ≥ intervention ⇒ sweep (see §1)
```

**Location updates happen only while the driver's app is active, in the foreground** (V1, A12). The driver app:
- sends `driver_heartbeat(lat?, lng?, accuracy?)` every `location_update_interval_seconds` (default 10 s) while the app is in the foreground **and** the driver is online or on a trip. Coordinates are optional, since GPS may be unavailable;
- stops sending when the app is backgrounded, the screen locks, or the driver goes offline. If the phone stays silent past `driver_stale_seconds`, the server treats the driver as unreachable;
- after coming back to the foreground, reads presence and resumes the heartbeat. If the trip was suspended meanwhile, it offers **Resume trip**.

Server behaviour:
- **Throttling:** heartbeats closer together than `min_location_update_interval_seconds` are accepted but ignored (`THROTTLED`).
- **Offline drivers:** `driver_heartbeat` is rejected (`DRIVER_NOT_ONLINE`) when the driver is offline with no trip, so there is no tracking when not working.
- **Going offline:** `go_offline` clears the stored location.
- **Broadcasting:** location is broadcast to the private channel `trip:<id>` only when the driver has an active trip.

Background location (screen locked / app in background) is deliberately **not** implemented in V1.

---

## 4. Issue (complaint) lifecycle

```
OPEN ──admin: start review──► IN_REVIEW ──admin: resolve(note)──► RESOLVED
  └──────────────── admin: close (duplicate/invalid, note) ─────► CLOSED
```
- **Sources:** `PASSENGER`, `DRIVER`, `SYSTEM`.
- **Kinds:** `DRIVER_UNREACHABLE` and `TRIP_STUCK` (system only), `BOOKING_ISSUE`, `DRIVER_BEHAVIOUR`, `PAYMENT`, `OTHER`.
- **De-duplication:** at most one open system issue of each kind per trip (partial unique index).
- **Auto-resolution:** `resume_trip` resolves the open unreachable issue automatically.

---

## 5. Ledger

Ledger rows are **append-only**: they have no status, and can never be updated, deleted or truncated (enforced by triggers). A mistaken posting is corrected by a new `ADJUSTMENT` transaction, optionally referencing the original through `reverses_transaction_id`. Settlement recording (cash settlements by admin) comes with the admin phase. Digital payouts come later, with a payment provider.
