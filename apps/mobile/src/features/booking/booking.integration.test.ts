/// <reference types="node" />
// Integration tests for the Step 4 data-layer RPCs (get_my_booking_history, get_my_booking,
// get_driver_home) against the local Supabase. Requires `pnpm db:start` + `pnpm mobile:env`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from '@sawari/types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validateEnv } from '@/lib/env';

const SEED_PASSWORD = 'SawariDev#2026';

function mobileEnv() {
  const file = readFileSync(join(__dirname, '..', '..', '..', '.env.local'), 'utf8');
  const get = (k: string) => file.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1];
  const result = validateEnv({ url: get('EXPO_PUBLIC_SUPABASE_URL'), anonKey: get('EXPO_PUBLIC_SUPABASE_ANON_KEY') });
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

describe('Step 4 data layer (RPCs against local Supabase)', () => {
  const env = mobileEnv();
  let rajClient: SupabaseClient<Database>;
  let priyaClient: SupabaseClient<Database>;
  let nehaClient: SupabaseClient<Database>;
  let tripId: string;
  let priyaBookingId: string;

  beforeAll(async () => {
    // Sign in seeded users with separate clients (different sessions)
    rajClient = anonClient(env);
    priyaClient = anonClient(env);
    nehaClient = anonClient(env);
    await signIn(rajClient, 'raj.kumar@sawaribuddy.local');
    await signIn(priyaClient, 'priya@sawaribuddy.local');
    await signIn(nehaClient, 'neha@sawaribuddy.local');

    // Raj opens a trip
    const { data: trip } = await rajClient.rpc('open_trip', {
      p_auto_id: '00000000-0000-4000-b000-000000000102',
      p_route_id: '00000000-0000-4000-d000-000000000001',
    });
    tripId = (trip as { id: string }).id;

    // Raj heartbeats to be reachable
    await rajClient.rpc('driver_heartbeat', { p_lat: 28.57, p_lng: 77.33, p_accuracy_m: 5 });

    // Priya books 2 seats
    const { data: booking } = await priyaClient.rpc('book_seats', {
      p_trip_id: tripId,
      p_seat_count: 2,
      p_idempotency_key: crypto.randomUUID(),
      p_seat_preference: 'ANY',
    });
    priyaBookingId = (booking as { id: string }).id;
  });

  afterAll(async () => {
    // Cancel the trip to clean up
    await rajClient.rpc('cancel_trip', { p_trip_id: tripId, p_reason: 'DRIVER_CANCELLED' });
  });

  // -------------------------------------------------------------------------
  // get_my_booking_history
  // -------------------------------------------------------------------------
  it("returns Priya's booking in history", async () => {
    const { data } = await priyaClient.rpc('get_my_booking_history', { p_limit: 10, p_before: undefined });
    expect(data).not.toBeNull();
    const history = data as unknown[];
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThanOrEqual(1);
    const latest = history[0] as Record<string, unknown>;
    expect(latest).toHaveProperty('code');
    expect(latest).toHaveProperty('origin');
    expect(latest).toHaveProperty('destination');
    expect(latest).toHaveProperty('driver_first_name');
  });

  it('returns empty for Neha (no bookings on this trip)', async () => {
    const { data } = await nehaClient.rpc('get_my_booking_history', { p_limit: 10, p_before: undefined });
    expect(data).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    const { data } = await priyaClient.rpc('get_my_booking_history', { p_limit: 1, p_before: undefined });
    const result = data as unknown[];
    expect(result.length).toBeLessThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // get_my_booking
  // -------------------------------------------------------------------------
  it("returns Priya's booking detail", async () => {
    const { data } = await priyaClient.rpc('get_my_booking', { p_booking_id: priyaBookingId });
    expect(data).not.toBeNull();
    const detail = data as Record<string, unknown>;
    expect(detail).toHaveProperty('booking');
    expect(detail).toHaveProperty('trip');
    expect(detail).toHaveProperty('route');
    expect(detail).toHaveProperty('auto');
    expect(detail).toHaveProperty('driver');
    expect((detail.booking as Record<string, unknown>).id).toBe(priyaBookingId);
  });

  it("blocks Neha from seeing Priya's booking", async () => {
    const { data } = await nehaClient.rpc('get_my_booking', { p_booking_id: priyaBookingId });
    expect(data).toBeNull();
  });

  it('returns null for non-existent booking', async () => {
    const { data } = await priyaClient.rpc('get_my_booking', {
      p_booking_id: '00000000-0000-0000-0000-000000000099',
    });
    expect(data).toBeNull();
  });

  // -------------------------------------------------------------------------
  // get_driver_home
  // -------------------------------------------------------------------------
  it("returns Raj's driver dashboard with active trip", async () => {
    const { data } = await rajClient.rpc('get_driver_home');
    expect(data).not.toBeNull();
    const home = data as Record<string, unknown>;
    expect(home).toHaveProperty('presence');
    expect(home).toHaveProperty('active_trip');
    expect(home).toHaveProperty('auto');
    expect(home).toHaveProperty('earnings');
    expect(home).toHaveProperty('server_time');
    // Active trip should be the one we opened
    const activeTrip = home.active_trip as Record<string, unknown>;
    expect(activeTrip).not.toBeNull();
    expect((activeTrip.trip as Record<string, unknown>).id).toBe(tripId);
    expect(activeTrip.occupied_seats).toBe(2);
    // Manifest should have Priya's booking
    const bookings = activeTrip.bookings as Array<Record<string, unknown>>;
    expect(bookings.length).toBe(1);
    expect(bookings[0]!.passenger_first_name).toBe('Priya');
  });

  it('blocks passenger from calling get_driver_home', async () => {
    const { error } = await priyaClient.rpc('get_driver_home');
    expect(error).not.toBeNull();
    expect(error!.message).toBe('NOT_AUTHORISED');
  });

  it("shows Raj's auto info", async () => {
    const { data } = await rajClient.rpc('get_driver_home');
    const home = data as Record<string, unknown>;
    const auto = home.auto as Record<string, unknown>;
    expect(auto.registration_number).toBe('DL01AB1234');
  });
});
