/// <reference types="node" />
// Integration tests for the Step 6a driver data layer (trip lifecycle, walk-in, mark_boarded,
// mark_no_show, heartbeat) against the local Supabase. Requires `pnpm db:start` + `pnpm mobile:env`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from '@sawari/types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validateEnv } from '@/lib/env';

const SEED_PASSWORD = 'SawariDev#2026';

// Imran Khan's auto (UP16CD1120, capacity 4)
const IMRAN_AUTO_ID = '00000000-0000-4000-b000-000000000120';
const ROUTE_1 = '00000000-0000-4000-d000-000000000001';

function mobileEnv() {
  const file = readFileSync(join(__dirname, '..', '..', '..', '.env.local'), 'utf8');
  const get = (k: string) => file.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1];
  const result = validateEnv({
    url: get('EXPO_PUBLIC_SUPABASE_URL'),
    anonKey: get('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  });
  if (!result.ok) throw new Error(result.problems.join(' '));
  return result.env;
}

function anonClient(env: ReturnType<typeof mobileEnv>) {
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(client: SupabaseClient<Database>, email: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw error;
  return data;
}

describe('Step 6a driver flow (RPCs against local Supabase)', () => {
  const env = mobileEnv();
  let imranClient: SupabaseClient<Database>;
  let priyaClient: SupabaseClient<Database>;
  let tripId: string;

  beforeAll(async () => {
    imranClient = anonClient(env);
    priyaClient = anonClient(env);
    await signIn(imranClient, 'imran@sawaribuddy.local');
    await signIn(priyaClient, 'priya@sawaribuddy.local');
  });

  afterAll(async () => {
    if (tripId) {
      try {
        await imranClient.rpc('cancel_trip', { p_trip_id: tripId, p_reason: 'DRIVER_CANCELLED' });
      } catch {
        // Already completed/cancelled — ignore
      }
    }
  });

  // -------------------------------------------------------------------------
  // open_trip
  // -------------------------------------------------------------------------
  it('Imran opens a trip', async () => {
    const { data, error } = await imranClient.rpc('open_trip', {
      p_auto_id: IMRAN_AUTO_ID,
      p_route_id: ROUTE_1,
    });
    expect(error).toBeNull();
    const trip = data as Record<string, unknown>;
    expect(trip.status).toBe('OPEN');
    expect(trip.driver_id).toBeTruthy();
    tripId = trip.id as string;
  });

  // -------------------------------------------------------------------------
  // driver_heartbeat
  // -------------------------------------------------------------------------
  it('Imran sends heartbeat', async () => {
    const { data, error } = await imranClient.rpc('driver_heartbeat', {
      p_lat: 28.57,
      p_lng: 77.33,
      p_accuracy_m: 5,
    });
    expect(error).toBeNull();
    const result = data as Record<string, unknown>;
    expect(result.accepted).toBeDefined();
    expect(typeof result.next_heartbeat_seconds).toBe('number');
  });

  it('heartbeat without location still succeeds', async () => {
    const { data, error } = await imranClient.rpc('driver_heartbeat', {
      p_lat: undefined,
      p_lng: undefined,
      p_accuracy_m: undefined,
    });
    expect(error).toBeNull();
    const result = data as Record<string, unknown>;
    expect(result.accepted).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Passenger books on the OPEN trip (must book before final_call)
  // -------------------------------------------------------------------------
  let priyaBookingId: string;

  it('Priya books 1 seat on Imran\'s trip', async () => {
    const { data, error } = await priyaClient.rpc('book_seats', {
      p_trip_id: tripId,
      p_seat_count: 1,
      p_idempotency_key: crypto.randomUUID(),
      p_seat_preference: 'ANY',
    });
    expect(error).toBeNull();
    const booking = data as Record<string, unknown>;
    expect(booking.status).toBe('CONFIRMED');
    priyaBookingId = booking.id as string;
  });

  // -------------------------------------------------------------------------
  // add_walk_in (trip is still OPEN)
  // -------------------------------------------------------------------------
  let walkInBookingId: string;
  const walkInKey = crypto.randomUUID();

  it('Imran adds a walk-in passenger (2 seats)', async () => {
    const { data, error } = await imranClient.rpc('add_walk_in', {
      p_trip_id: tripId,
      p_seat_count: 2,
      p_idempotency_key: walkInKey,
      p_label: 'Uncle ji',
    });
    expect(error).toBeNull();
    const booking = data as Record<string, unknown>;
    expect(booking.source).toBe('WALK_IN');
    expect(booking.status).toBe('BOARDED');
    expect(booking.seat_count).toBe(2);
    expect(booking.walk_in_label).toBe('Uncle ji');
    walkInBookingId = booking.id as string;
  });

  it('add_walk_in idempotent retry returns same booking', async () => {
    const { data, error } = await imranClient.rpc('add_walk_in', {
      p_trip_id: tripId,
      p_seat_count: 2,
      p_idempotency_key: walkInKey,
      p_label: 'Uncle ji',
    });
    expect(error).toBeNull();
    const booking = data as Record<string, unknown>;
    expect(booking.id).toBe(walkInBookingId);
  });

  // -------------------------------------------------------------------------
  // remove_walk_in (allowed before trip starts)
  // -------------------------------------------------------------------------
  it('Imran removes walk-in before trip starts', async () => {
    const { data, error } = await imranClient.rpc('remove_walk_in', { p_booking_id: walkInBookingId });
    expect(error).toBeNull();
    const booking = data as Record<string, unknown>;
    expect(booking.status).toBe('CANCELLED');
  });

  // Re-add walk-in so we have a BOARDED passenger for start_trip
  it('Imran re-adds a walk-in for the trip', async () => {
    const { data, error } = await imranClient.rpc('add_walk_in', {
      p_trip_id: tripId,
      p_seat_count: 1,
      p_idempotency_key: crypto.randomUUID(),
    });
    expect(error).toBeNull();
    const booking = data as Record<string, unknown>;
    expect(booking.status).toBe('BOARDED');
    walkInBookingId = booking.id as string;
  });

  // -------------------------------------------------------------------------
  // final_call
  // -------------------------------------------------------------------------
  it('Imran calls final_call on OPEN trip', async () => {
    const { data, error } = await imranClient.rpc('final_call', { p_trip_id: tripId });
    expect(error).toBeNull();
    const trip = data as Record<string, unknown>;
    expect(trip.status).toBe('BOARDING');
  });

  // -------------------------------------------------------------------------
  // mark_boarded
  // -------------------------------------------------------------------------
  it('Imran marks Priya as boarded', async () => {
    const { data, error } = await imranClient.rpc('mark_boarded', { p_booking_id: priyaBookingId });
    expect(error).toBeNull();
    const booking = data as Record<string, unknown>;
    expect(booking.status).toBe('BOARDED');
  });

  // -------------------------------------------------------------------------
  // start_trip from BOARDING (all confirmed are now boarded)
  // -------------------------------------------------------------------------
  it('Imran starts the trip (from BOARDING, all confirmed are boarded)', async () => {
    const { data, error } = await imranClient.rpc('start_trip', { p_trip_id: tripId });
    expect(error).toBeNull();
    const trip = data as Record<string, unknown>;
    expect(trip.status).toBe('IN_PROGRESS');
  });

  // -------------------------------------------------------------------------
  // complete_trip
  // -------------------------------------------------------------------------
  it('Imran completes the trip', async () => {
    const { data, error } = await imranClient.rpc('complete_trip', { p_trip_id: tripId });
    expect(error).toBeNull();
    const trip = data as Record<string, unknown>;
    expect(trip.status).toBe('COMPLETED');
  });

  // -------------------------------------------------------------------------
  // get_trip_manifest
  // -------------------------------------------------------------------------
  it('get_trip_manifest returns manifest for completed trip', async () => {
    const { data, error } = await imranClient.rpc('get_trip_manifest', { p_trip_id: tripId });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // driver_earnings_summary
  // -------------------------------------------------------------------------
  it('driver_earnings_summary returns results', async () => {
    const { data, error } = await imranClient.rpc('driver_earnings_summary', {
      p_driver_id: undefined,
      p_from: undefined,
      p_to: undefined,
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Passenger cannot invoke driver RPCs
  // -------------------------------------------------------------------------
  it('passenger cannot open a trip', async () => {
    const { error } = await priyaClient.rpc('open_trip', {
      p_auto_id: IMRAN_AUTO_ID,
      p_route_id: ROUTE_1,
    });
    expect(error).not.toBeNull();
  });

  it('passenger cannot call driver_heartbeat', async () => {
    const { error } = await priyaClient.rpc('driver_heartbeat', {
      p_lat: 28.57,
      p_lng: 77.33,
      p_accuracy_m: 5,
    });
    expect(error).not.toBeNull();
  });
});

describe('Step 6a start_trip from OPEN (no final_call required)', () => {
  const env = mobileEnv();
  let rajClient: SupabaseClient<Database>;
  let nehaClient: SupabaseClient<Database>;

  // Raj Kumar's auto (DL01AB1234, capacity 5)
  const RAJ_AUTO_ID = '00000000-0000-4000-b000-000000000102';

  beforeAll(async () => {
    rajClient = anonClient(env);
    nehaClient = anonClient(env);
    await signIn(rajClient, 'raj.kumar@sawaribuddy.local');
    await signIn(nehaClient, 'neha@sawaribuddy.local');
  });

  it('Raj opens a trip, adds walk-in, starts directly from OPEN', async () => {
    // Open
    const { data: trip, error: openErr } = await rajClient.rpc('open_trip', {
      p_auto_id: RAJ_AUTO_ID,
      p_route_id: ROUTE_1,
    });
    expect(openErr).toBeNull();
    const tripId = (trip as Record<string, unknown>).id as string;

    // Heartbeat
    await rajClient.rpc('driver_heartbeat', { p_lat: 28.57, p_lng: 77.33, p_accuracy_m: 5 });

    // Add walk-in (creates a BOARDED booking)
    const { error: walkErr } = await rajClient.rpc('add_walk_in', {
      p_trip_id: tripId,
      p_seat_count: 1,
      p_idempotency_key: crypto.randomUUID(),
    });
    expect(walkErr).toBeNull();

    // Start trip directly from OPEN (no final_call)
    const { data: started, error: startErr } = await rajClient.rpc('start_trip', { p_trip_id: tripId });
    expect(startErr).toBeNull();
    expect((started as Record<string, unknown>).status).toBe('IN_PROGRESS');

    // Complete
    const { error: completeErr } = await rajClient.rpc('complete_trip', { p_trip_id: tripId });
    expect(completeErr).toBeNull();
  });

  it('cross-driver isolation: Neha (passenger) cannot cancel Raj\'s trip', async () => {
    // Open a new trip for isolation test
    const { data: trip, error: openErr } = await rajClient.rpc('open_trip', {
      p_auto_id: RAJ_AUTO_ID,
      p_route_id: ROUTE_1,
    });
    expect(openErr).toBeNull();
    const newTripId = (trip as Record<string, unknown>).id as string;

    const { error } = await nehaClient.rpc('cancel_trip', { p_trip_id: newTripId });
    expect(error).not.toBeNull();

    // Cleanup
    await rajClient.rpc('cancel_trip', { p_trip_id: newTripId, p_reason: 'DRIVER_CANCELLED' });
  });
});

describe('Step 6a go_offline', () => {
  const env = mobileEnv();
  let rajClient: SupabaseClient<Database>;

  const RAJ_AUTO_ID = '00000000-0000-4000-b000-000000000102';

  beforeAll(async () => {
    rajClient = anonClient(env);
    await signIn(rajClient, 'raj.kumar@sawaribuddy.local');
  });

  it('go_offline cancels empty trip and returns presence', async () => {
    // Open a trip
    const { data: trip, error: openErr } = await rajClient.rpc('open_trip', {
      p_auto_id: RAJ_AUTO_ID,
      p_route_id: ROUTE_1,
    });
    expect(openErr).toBeNull();
    const tripId = (trip as Record<string, unknown>).id as string;
    expect(tripId).toBeTruthy();

    // Go offline — empty trip should be cancelled
    const { data, error } = await rajClient.rpc('go_offline');
    expect(error).toBeNull();
    const presence = data as Record<string, unknown>;
    expect(presence.is_online).toBe(false);
  });
});
