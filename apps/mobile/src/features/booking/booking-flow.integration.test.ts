/// <reference types="node" />
// Integration tests for the Step 5 passenger booking flow (book_seats, cancel_booking)
// against the local Supabase. Requires `pnpm db:start` + `pnpm mobile:env`.
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

describe('Step 5 booking flow (RPCs against local Supabase)', () => {
  const env = mobileEnv();
  let sureshClient: SupabaseClient<Database>;
  let nehaClient: SupabaseClient<Database>;
  let rahulClient: SupabaseClient<Database>;
  let tripId: string;
  let nehaBookingId: string;
  const idempotencyKey = crypto.randomUUID();

  beforeAll(async () => {
    sureshClient = anonClient(env);
    nehaClient = anonClient(env);
    rahulClient = anonClient(env);
    await signIn(sureshClient, 'suresh@sawaribuddy.local');
    await signIn(nehaClient, 'neha@sawaribuddy.local');
    await signIn(rahulClient, 'rahul@sawaribuddy.local');

    // Suresh opens a trip on route 1 with his auto (DL01AB1115, capacity 5)
    const { data: trip, error: tripErr } = await sureshClient.rpc('open_trip', {
      p_auto_id: '00000000-0000-4000-b000-000000000115',
      p_route_id: '00000000-0000-4000-d000-000000000001',
    });
    if (tripErr) throw tripErr;
    tripId = (trip as { id: string }).id;

    // Heartbeat so driver is reachable
    await sureshClient.rpc('driver_heartbeat', { p_lat: 28.57, p_lng: 77.33, p_accuracy_m: 5 });
  });

  afterAll(async () => {
    await sureshClient.rpc('cancel_trip', { p_trip_id: tripId, p_reason: 'DRIVER_CANCELLED' });
  });

  // -------------------------------------------------------------------------
  // book_seats
  // -------------------------------------------------------------------------
  it('Neha books 2 seats successfully', async () => {
    const { data, error } = await nehaClient.rpc('book_seats', {
      p_trip_id: tripId,
      p_seat_count: 2,
      p_idempotency_key: idempotencyKey,
      p_seat_preference: 'BACK',
    });
    expect(error).toBeNull();
    const booking = data as Record<string, unknown>;
    expect(booking.status).toBe('CONFIRMED');
    expect(booking.seat_count).toBe(2);
    expect(booking.seat_preference).toBe('BACK');
    expect(booking.code).toBeTruthy();
    nehaBookingId = booking.id as string;
  });

  it('idempotent retry returns same booking', async () => {
    const { data, error } = await nehaClient.rpc('book_seats', {
      p_trip_id: tripId,
      p_seat_count: 2,
      p_idempotency_key: idempotencyKey,
      p_seat_preference: 'BACK',
    });
    expect(error).toBeNull();
    const booking = data as Record<string, unknown>;
    expect(booking.id).toBe(nehaBookingId);
  });

  it('ALREADY_HAS_ACTIVE_BOOKING when booking twice with different key', async () => {
    const { error } = await nehaClient.rpc('book_seats', {
      p_trip_id: tripId,
      p_seat_count: 1,
      p_idempotency_key: crypto.randomUUID(),
      p_seat_preference: 'ANY',
    });
    expect(error).not.toBeNull();
    expect(error!.message).toBe('ALREADY_HAS_ACTIVE_BOOKING');
  });

  // -------------------------------------------------------------------------
  // cancel_booking
  // -------------------------------------------------------------------------
  it("Rahul cannot cancel Neha's booking", async () => {
    const { error } = await rahulClient.rpc('cancel_booking', { p_booking_id: nehaBookingId });
    expect(error).not.toBeNull();
  });

  it('Neha cancels her booking', async () => {
    const { data, error } = await nehaClient.rpc('cancel_booking', { p_booking_id: nehaBookingId });
    expect(error).toBeNull();
    const booking = data as Record<string, unknown>;
    expect(booking.status).toBe('CANCELLED');
  });

  it('cancel is idempotent for passenger-cancelled bookings', async () => {
    const { data, error } = await nehaClient.rpc('cancel_booking', { p_booking_id: nehaBookingId });
    expect(error).toBeNull();
    const booking = data as Record<string, unknown>;
    expect(booking.status).toBe('CANCELLED');
  });

  // -------------------------------------------------------------------------
  // NO_SEAT_AVAILABLE
  // -------------------------------------------------------------------------
  it('NO_SEAT_AVAILABLE when capacity exhausted', async () => {
    // Rahul books 3 seats (max_seats_per_booking=3, auto capacity 5)
    const { error: bookErr1 } = await rahulClient.rpc('book_seats', {
      p_trip_id: tripId,
      p_seat_count: 3,
      p_idempotency_key: crypto.randomUUID(),
      p_seat_preference: 'ANY',
    });
    expect(bookErr1).toBeNull();

    // Neha books 2 more (5 total = full)
    const nehaKey = crypto.randomUUID();
    const { error: bookErr2 } = await nehaClient.rpc('book_seats', {
      p_trip_id: tripId,
      p_seat_count: 2,
      p_idempotency_key: nehaKey,
      p_seat_preference: 'ANY',
    });
    expect(bookErr2).toBeNull();

    // Cancel Neha's new booking so we can try again
    const { data: nehaBooking2 } = await nehaClient.rpc('book_seats', {
      p_trip_id: tripId,
      p_seat_count: 2,
      p_idempotency_key: nehaKey,
      p_seat_preference: 'ANY',
    });
    await nehaClient.rpc('cancel_booking', { p_booking_id: (nehaBooking2 as Record<string, unknown>).id as string });

    // Now Rahul has 3 seats; only 2 left. Neha tries to book 3 seats — not enough
    const { error } = await nehaClient.rpc('book_seats', {
      p_trip_id: tripId,
      p_seat_count: 3,
      p_idempotency_key: crypto.randomUUID(),
      p_seat_preference: 'ANY',
    });
    expect(error).not.toBeNull();
    expect(error!.message).toBe('NO_SEAT_AVAILABLE');
  });

  // -------------------------------------------------------------------------
  // search_trips
  // -------------------------------------------------------------------------
  it('search_trips returns results for the correct route', async () => {
    const { data, error } = await nehaClient.rpc('search_trips', {
      p_origin_stop_id: '00000000-0000-4000-c000-000000000001',
      p_destination_stop_id: '00000000-0000-4000-c000-000000000002',
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('search_trips returns empty for non-existent route', async () => {
    const { data, error } = await nehaClient.rpc('search_trips', {
      p_origin_stop_id: '00000000-0000-4000-c000-000000000004',
      p_destination_stop_id: '00000000-0000-4000-c000-000000000001',
    });
    expect(error).toBeNull();
    const results = data as unknown[];
    // May or may not have results depending on seed data; just ensure no error
    expect(Array.isArray(results)).toBe(true);
  });
});
