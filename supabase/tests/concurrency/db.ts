import { randomUUID } from 'node:crypto';
import pg from 'pg';

const DEFAULT_URL = 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

export const DB_URL = process.env.SUPABASE_DB_URL ?? DEFAULT_URL;

// These tests create users and trips with a superuser connection. Refuse anything but a local database.
const host = new URL(DB_URL).hostname;
if (host !== '127.0.0.1' && host !== 'localhost') {
  throw new Error(`Concurrency tests only run against a local database, got host "${host}"`);
}

export async function connect(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  return client;
}

/** A connection that behaves like a signed-in app user calling RPCs through the API. */
export async function connectAs(userId: string): Promise<pg.Client> {
  const client = await connect();
  await client.query('set role authenticated');
  await client.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
  return client;
}

export interface Fixture {
  driverId: string;
  autoId: string;
  routeId: string;
  stopIds: string[];
  userIds: string[];
  tripIds: string[];
}

/** Creates an isolated driver + auto (given capacity) + route, so runs never collide with seed data. */
export async function createDriverFixture(admin: pg.Client, capacity: number): Promise<Fixture> {
  const tag = randomUUID().slice(0, 8);
  const driverId = await createUser(admin, `driver-${tag}@test.local`, `Test Driver ${tag}`);
  await admin.query("update public.profiles set role = 'DRIVER' where id = $1", [driverId]);
  await admin.query(
    "insert into public.drivers (id, license_number, status, verified_at) values ($1, $2, 'ACTIVE', now())",
    [driverId, `LIC${tag.toUpperCase()}`],
  );
  const auto = await admin.query<{ id: string }>(
    'insert into public.autos (registration_number, capacity) values ($1, $2) returning id',
    [`TS${tag.toUpperCase().replace(/[^A-Z0-9]/g, '0')}`, capacity],
  );
  const autoId = auto.rows[0]!.id;
  await admin.query('insert into public.auto_assignments (auto_id, driver_id) values ($1, $2)', [autoId, driverId]);
  const stops = await admin.query<{ id: string }>(
    'insert into public.stops (name, lat, lng) values ($1, 28.57, 77.32), ($2, 28.61, 77.43) returning id',
    [`Origin ${tag}`, `Destination ${tag}`],
  );
  const stopIds = stops.rows.map((r) => r.id);
  const route = await admin.query<{ id: string }>(
    'insert into public.routes (origin_stop_id, destination_stop_id, fare_paise) values ($1, $2, 3000) returning id',
    [stopIds[0], stopIds[1]],
  );
  return { driverId, autoId, routeId: route.rows[0]!.id, stopIds, userIds: [driverId], tripIds: [] };
}

export async function createUser(admin: pg.Client, email: string, fullName: string): Promise<string> {
  const id = randomUUID();
  await admin.query(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                             raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now(),
             '{"provider":"email","providers":["email"]}', $3, now(), now())`,
    [id, email, JSON.stringify({ full_name: fullName })],
  );
  return id;
}

export async function createPassengers(admin: pg.Client, fixture: Fixture, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const tag = randomUUID().slice(0, 8);
    ids.push(await createUser(admin, `passenger-${tag}@test.local`, `Passenger ${i + 1}`));
  }
  fixture.userIds.push(...ids);
  return ids;
}

export async function occupiedSeats(admin: pg.Client, tripId: string): Promise<number> {
  const res = await admin.query<{ seats: number }>('select private.trip_occupied_seats($1) as seats', [tripId]);
  return res.rows[0]!.seats;
}

export async function backendPid(client: pg.Client): Promise<number> {
  const res = await client.query<{ pid: number }>('select pg_backend_pid() as pid');
  return res.rows[0]!.pid;
}

/**
 * How many of the given backends are currently blocked on a lock. When many sessions queue for one row,
 * only the first waits on the lock holder directly; the rest queue behind it, so we count lock waits.
 */
export async function lockWaiters(admin: pg.Client, pids: number[]): Promise<number> {
  const res = await admin.query<{ n: number }>(
    "select count(*)::int as n from pg_stat_activity where pid = any($1) and wait_event_type = 'Lock' and cardinality(pg_blocking_pids(pid)) > 0",
    [pids],
  );
  return res.rows[0]!.n;
}

export async function waitFor(check: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** Removes everything a fixture created (local test data only). */
export async function cleanup(admin: pg.Client, fixture: Fixture): Promise<void> {
  const { tripIds, userIds, autoId, routeId, stopIds } = fixture;
  await admin.query('update public.driver_presence set active_trip_id = null where active_trip_id = any($1)', [tripIds]);
  await admin.query('delete from public.bookings where trip_id = any($1)', [tripIds]);
  await admin.query('delete from public.trips where id = any($1)', [tripIds]);
  await admin.query('delete from public.auto_assignments where auto_id = $1', [autoId]);
  await admin.query('delete from public.autos where id = $1', [autoId]);
  await admin.query('delete from public.routes where id = $1', [routeId]);
  await admin.query('delete from public.stops where id = any($1)', [stopIds]);
  await admin.query('delete from auth.users where id = any($1)', [userIds]);
}

export function errorCode(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
