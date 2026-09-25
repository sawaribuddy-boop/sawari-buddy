import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanup,
  connect,
  connectAs,
  createDriverFixture,
  createPassengers,
  errorCode,
  type Fixture,
  backendPid,
  lockWaiters,
  occupiedSeats,
  waitFor,
} from './db';

interface BookingRow {
  id: string;
  status: string;
}

const CAPACITY = 5;

async function bookSeats(client: pg.Client, tripId: string, seats: number, key: string): Promise<BookingRow> {
  const res = await client.query<BookingRow>(
    'select id, status from public.book_seats($1, $2::smallint, $3::uuid)',
    [tripId, seats, key],
  );
  return res.rows[0]!;
}

interface Racer<T> {
  client: pg.Client;
  request: () => Promise<T>;
}

/**
 * Holds the trip row lock from a separate connection, fires all requests, waits until Postgres reports
 * every request blocked on a lock (proving they are genuinely in flight at the same time), then releases them.
 */
async function raceOnTrip<T>(admin: pg.Client, tripId: string, racers: Array<Racer<T>>) {
  const pids = await Promise.all(racers.map((r) => backendPid(r.client)));
  const gate = await connect();
  try {
    await gate.query('begin');
    await gate.query('select 1 from public.trips where id = $1 for update', [tripId]);

    const pending = Promise.allSettled(racers.map((r) => r.request()));
    await waitFor(async () => (await lockWaiters(admin, pids)) === racers.length);
    const blockedSimultaneously = await lockWaiters(admin, pids);

    await gate.query('commit');
    return { results: await pending, blockedSimultaneously };
  } finally {
    await gate.end();
  }
}

describe('book_seats under concurrency', () => {
  let admin: pg.Client;
  let fixture: Fixture;
  const clients: pg.Client[] = [];

  beforeAll(async () => {
    admin = await connect();
    fixture = await createDriverFixture(admin, CAPACITY);
  });

  afterAll(async () => {
    await Promise.all(clients.map((c) => c.end()));
    if (fixture) await cleanup(admin, fixture);
    await admin.end();
  });

  async function openTrip(): Promise<string> {
    const driver = await connectAs(fixture.driverId);
    clients.push(driver);
    const trip = await driver.query<{ id: string }>('select id from public.open_trip($1, $2)', [fixture.autoId, fixture.routeId]);
    const tripId = trip.rows[0]!.id;
    fixture.tripIds.push(tripId);
    return tripId;
  }

  async function closeTrip(tripId: string): Promise<void> {
    const driver = await connectAs(fixture.driverId);
    clients.push(driver);
    await driver.query('select public.cancel_trip($1)', [tripId]);
  }

  it('20 simultaneous bookings for exactly 1 remaining seat: 1 succeeds, 19 get NO_SEAT_AVAILABLE', async () => {
    const tripId = await openTrip();

    // Occupy 4 of 5 seats with a realistic mix: 2 app passengers + a walk-in group of 2.
    const early = await createPassengers(admin, fixture, 2);
    for (const passengerId of early) {
      const c = await connectAs(passengerId);
      clients.push(c);
      await bookSeats(c, tripId, 1, randomUUID());
    }
    const driver = await connectAs(fixture.driverId);
    clients.push(driver);
    await driver.query('select public.add_walk_in($1, 2::smallint, $2::uuid)', [tripId, randomUUID()]);
    expect(await occupiedSeats(admin, tripId)).toBe(CAPACITY - 1);

    // 20 different passengers, each with their own connection and idempotency key.
    const racers = await createPassengers(admin, fixture, 20);
    const racerClients = await Promise.all(racers.map((id) => connectAs(id)));
    clients.push(...racerClients);
    const keys = racers.map(() => randomUUID());

    const { results, blockedSimultaneously } = await raceOnTrip(
      admin,
      tripId,
      racerClients.map((client, i) => ({ client, request: () => bookSeats(client, tripId, 1, keys[i]!) })),
    );

    expect(blockedSimultaneously).toBe(20);

    const succeeded = results.flatMap((r, i) => (r.status === 'fulfilled' ? [{ index: i, booking: r.value }] : []));
    const failed = results.flatMap((r) => (r.status === 'rejected' ? [errorCode(r.reason)] : []));

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(19);
    expect(failed.every((code) => code === 'NO_SEAT_AVAILABLE')).toBe(true);

    // Occupancy never exceeds capacity.
    expect(await occupiedSeats(admin, tripId)).toBe(CAPACITY);
    const racerRows = await admin.query<{ n: number }>(
      "select count(*)::int as n from public.bookings where trip_id = $1 and passenger_id = any($2) and status = 'CONFIRMED'",
      [tripId, racers],
    );
    expect(racerRows.rows[0]!.n).toBe(1);

    // Retrying the winning request (same idempotency key) returns the same booking and creates nothing new.
    const winner = succeeded[0]!;
    const winnerClient = racerClients[winner.index]!;
    const retry = await bookSeats(winnerClient, tripId, 1, keys[winner.index]!);
    expect(retry.id).toBe(winner.booking.id);

    const concurrentRetries = await Promise.all(
      Array.from({ length: 5 }, async () => {
        const c = await connectAs(racers[winner.index]!);
        clients.push(c);
        return bookSeats(c, tripId, 1, keys[winner.index]!);
      }),
    );
    expect(new Set(concurrentRetries.map((b) => b.id))).toEqual(new Set([winner.booking.id]));

    const winnerRows = await admin.query<{ n: number }>(
      'select count(*)::int as n from public.bookings where passenger_id = $1',
      [racers[winner.index]],
    );
    expect(winnerRows.rows[0]!.n).toBe(1);
    expect(await occupiedSeats(admin, tripId)).toBe(CAPACITY);

    await closeTrip(tripId);
  });

  it('walk-in and app booking racing for the last seat: exactly one wins', async () => {
    const tripId = await openTrip();
    const driver = await connectAs(fixture.driverId);
    clients.push(driver);
    await driver.query('select public.add_walk_in($1, 4::smallint, $2::uuid)', [tripId, randomUUID()]);

    const [passengerId] = await createPassengers(admin, fixture, 1);
    const passenger = await connectAs(passengerId!);
    const driver2 = await connectAs(fixture.driverId);
    clients.push(passenger, driver2);

    const { results, blockedSimultaneously } = await raceOnTrip(admin, tripId, [
      { client: passenger, request: () => bookSeats(passenger, tripId, 1, randomUUID()) },
      {
        client: driver2,
        request: () => driver2.query('select public.add_walk_in($1, 1::smallint, $2::uuid)', [tripId, randomUUID()]),
      },
    ]);

    expect(blockedSimultaneously).toBe(2);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.flatMap((r) => (r.status === 'rejected' ? [errorCode(r.reason)] : []));
    expect(rejected).toEqual(['NO_SEAT_AVAILABLE']);
    expect(await occupiedSeats(admin, tripId)).toBe(CAPACITY);

    await closeTrip(tripId);
  });

  it('10 simultaneous requests with the same idempotency key create exactly one booking', async () => {
    const tripId = await openTrip();
    const [passengerId] = await createPassengers(admin, fixture, 1);
    const sameUserClients = await Promise.all(Array.from({ length: 10 }, () => connectAs(passengerId!)));
    clients.push(...sameUserClients);
    const key = randomUUID();

    const { results } = await raceOnTrip(
      admin,
      tripId,
      sameUserClients.map((client) => ({ client, request: () => bookSeats(client, tripId, 1, key) })),
    );

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const ids = new Set(results.map((r) => (r.status === 'fulfilled' ? r.value.id : null)));
    expect(ids.size).toBe(1);

    const rows = await admin.query<{ n: number }>('select count(*)::int as n from public.bookings where passenger_id = $1', [passengerId]);
    expect(rows.rows[0]!.n).toBe(1);
    expect(await occupiedSeats(admin, tripId)).toBe(1);

    await closeTrip(tripId);
  });
});
