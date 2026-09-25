# SawariBuddy — State Machines

All transitions are performed **only** by database functions (RPCs) or the scheduled job. Clients never `UPDATE status` directly (RLS + column privileges prevent it). Every transition is logged to `booking_events` / `trip_events` with actor and reason.

Timing always uses database `now()`.

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
     │                         ▼                           │ (no app bookings CONFIRMED/WAITING)
     │                     BOARDING ───────────────────────┤
     │  (walk-ins only; no-show timer running)             │
     │                                                     ▼
     │                                               IN_PROGRESS
     │                                                     │ driver/admin: complete_trip
     │                                                     ▼
     │                                                COMPLETED (terminal)
     │
     │ driver/admin: cancel_trip  (from OPEN, BOARDING, SUSPENDED)
     └──────────────────────────────►  CANCELLED (terminal)

  OPEN / BOARDING ──(job: driver unseen ≥ driver_intervention_seconds
                     AND trip has occupying bookings)──► SUSPENDED
  SUSPENDED ──(driver: resume_trip, driver reachable again)──► previous status (OPEN|BOARDING)
  SUSPENDED ──(admin: cancel_trip)──► CANCELLED
```

| From | To | Actor / function | Guard | Side effects |
|---|---|---|---|---|
| — | `OPEN` | driver `open_trip(auto_id, route_id)` | driver `ACTIVE`; auto `ACTIVE` and assigned to driver; route active; driver has no active trip; auto has no active trip | snapshot `capacity`, `fare_paise`; set driver presence online + `active_trip_id` |
| `OPEN` | `BOARDING` | driver `final_call` | — | `final_call_at = now()`; all `CONFIRMED` app bookings → `WAITING` |
| `OPEN`/`BOARDING` | `IN_PROGRESS` | driver `start_trip` | no bookings in `CONFIRMED`/`WAITING`/`PENDING`; ≥ 1 `BOARDED` | `started_at = now()` |
| `IN_PROGRESS` | `COMPLETED` | driver or admin `complete_trip` | — | `BOARDED` bookings → `COMPLETED`; ledger postings; presence `active_trip_id = null` |
| `OPEN`/`BOARDING`/`SUSPENDED` | `CANCELLED` | driver or admin `cancel_trip(reason)` | — | all occupying bookings → `CANCELLED` (reason `TRIP_CANCELLED` or `DRIVER_UNREACHABLE`); presence `active_trip_id = null` |
| `OPEN`/`BOARDING` | `SUSPENDED` | job `sweep_unreachable_drivers` | driver unseen ≥ intervention threshold; trip has occupying bookings | `suspended_from_status` saved; system issue raised |
| `SUSPENDED` | `OPEN`/`BOARDING` | driver `resume_trip` | driver heartbeat fresh | `suspended_from_status` cleared; issue auto-annotated |
| `IN_PROGRESS` | *(no change)* | job | driver unseen ≥ intervention threshold | system issue raised (once per trip) |

Notes
- `IN_PROGRESS → CANCELLED` is **not** allowed for drivers (passengers are on board). Admin resolves via `complete_trip`.
- An `OPEN` trip with **zero** bookings whose driver goes stale is not suspended; it simply disappears from search (reachability is derived). If the driver later taps Go Offline, the trip is cancelled with reason `DRIVER_OFFLINE`. The job also auto-cancels empty `OPEN` trips unseen for the intervention threshold.
- Active statuses (for "one active trip per driver/auto"): `OPEN`, `BOARDING`, `IN_PROGRESS`, `SUSPENDED`.

---

## 2. Booking

Applies to both `APP` and `WALK_IN` sources (walk-ins use a subset).

```
                 (future prepaid flow only)
                        PENDING ──(hold expired / payment failed)──► CANCELLED
                           │ payment confirmed
                           ▼
   passenger: book_seats ─► CONFIRMED ──(trip final_call)──► WAITING
                              │   │                             │  │
                              │   └─ passenger/driver: board ─┐ │  └─ driver: mark_no_show
                              │                               ▼ ▼     (grace elapsed) ──► NO_SHOW (terminal)
                              │                             BOARDED
                              │                               │ trip complete_trip
                              │                               ▼
                              │                           COMPLETED (terminal)
                              │
      passenger: cancel ──────┴──► CANCELLED (terminal)  ◄── (also from WAITING;
                                                             from any occupying state via cancel_trip)

   driver: add_walk_in ─► BOARDED ─► COMPLETED
                            └─ driver: remove_walk_in (trip not IN_PROGRESS) ─► CANCELLED
```

| From | To | Actor / function | Guard |
|---|---|---|---|
| — | `CONFIRMED` | passenger `book_seats` | trip `OPEN`; driver reachable; seats available under lock; passenger has no other active booking; `seat_count` within limit |
| — | `BOARDED` (walk-in) | driver `add_walk_in` | trip `OPEN`/`BOARDING`¹; seats available under lock |
| `CONFIRMED` | `WAITING` | system, inside `final_call` | — |
| `CONFIRMED`/`WAITING` | `BOARDED` | driver `mark_boarded` | trip `OPEN`/`BOARDING` |
| `WAITING` | `NO_SHOW` | driver `mark_no_show` | `now() ≥ trip.final_call_at + no_show_grace_seconds` |
| `CONFIRMED`/`WAITING` | `CANCELLED` | passenger `cancel_booking` | booking belongs to caller |
| `BOARDED` (walk-in) | `CANCELLED` | driver `remove_walk_in` | trip not `IN_PROGRESS` |
| any occupying | `CANCELLED` | system, inside `cancel_trip` | — |
| `BOARDED` | `COMPLETED` | system, inside `complete_trip` | — |
| `PENDING` | `CONFIRMED`/`CANCELLED` | future payment flow | not produced in V1 |

¹ **Walk-ins during `IN_PROGRESS`**: in reality someone can hop on mid-route. V1 allows `add_walk_in` in `OPEN` and `BOARDING` only, because partial-route fares are out of scope (A3). Flagged for later.

Seat occupancy: `PENDING` (unexpired), `CONFIRMED`, `WAITING`, `BOARDED` occupy seats; `COMPLETED`, `CANCELLED`, `NO_SHOW` do not.

Terminal states: `COMPLETED`, `CANCELLED`, `NO_SHOW`.

`cancel_reason` values: `PASSENGER_CANCELLED`, `TRIP_CANCELLED`, `DRIVER_UNREACHABLE`, `WALK_IN_REMOVED`, `ADMIN_CANCELLED`, `HOLD_EXPIRED` (future).

---

## 3. Driver availability

Stored (one row per driver in `driver_presence`):

- `is_online` (boolean): the driver's **intent**, set by Go Online / Go Offline.
- `active_trip_id`: the current trip, if any.
- `last_seen_at`: last heartbeat of any kind.
- `lat`, `lng`, `accuracy_m`, `location_at`: last known location.

Derived (never stored):

| Derived state | Condition |
|---|---|
| `OFFLINE` | `is_online = false` |
| `ONLINE` | `is_online = true` and `now() − last_seen_at ≤ driver_stale_seconds` |
| `UNREACHABLE` | `is_online = true` and `now() − last_seen_at > driver_stale_seconds` |
| location `FRESH` / `STALE` / `NONE` | from `location_at` vs `driver_stale_seconds` |

```
 OFFLINE ──Go Online (open_trip)──► ONLINE ──no heartbeat > stale──► UNREACHABLE
    ▲                                 │  ▲                               │
    └────Go Offline (no active trip)──┘  └────────heartbeat──────────────┘
                                          UNREACHABLE ≥ intervention ⇒ trip SUSPENDED (see §1)
```

Driver app behaviour:
- While `is_online` or `active_trip_id` is set, send `driver_heartbeat(lat?, lng?, accuracy?)` every `location_update_interval_seconds`. Location fields are optional (GPS may be unavailable).
- On Go Offline (allowed only with no active trip) → stop location watcher.
- On app resume after being killed → read presence; if online, restart watcher.

---

## 4. Issue (complaint) lifecycle

```
OPEN ──admin: start review──► IN_REVIEW ──admin: resolve(note)──► RESOLVED
  └──────────────── admin: close (duplicate/invalid, note) ─────► CLOSED
```
Sources: `PASSENGER`, `DRIVER`, `SYSTEM` (driver unreachable, trip stuck). Kinds: `DRIVER_UNREACHABLE`, `TRIP_STUCK`, `BOOKING_ISSUE`, `DRIVER_BEHAVIOUR`, `PAYMENT`, `OTHER`.

---

## 5. Ledger transaction lifecycle

Ledger rows are **append-only**: no status, no updates, no deletes. A mistaken posting is corrected by a new `ADJUSTMENT` (or a reversing transaction referencing the original via `reverses_transaction_id`). Settlement records have their own simple status: `RECORDED` → (future: `INITIATED` → `PAID` / `FAILED` with payouts).
