/// <reference types="node" />
// Integration test for the driver's rating: a passenger rates the ride and the driver receives it on
// their own private realtime channel (driver:<id>); another driver listening there gets nothing.
// Requires `pnpm db:start` + `pnpm mobile:env`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from '@sawari/types';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validateEnv } from '@/lib/env';

const SEED_PASSWORD = 'SawariDev#2026';

// Suresh Yadav and his auto (DL01AB1115)
const SURESH_ID = '00000000-0000-4000-a000-000000000012';
const SURESH_AUTO_ID = '00000000-0000-4000-b000-000000000115';
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
  await client.realtime.setAuth(data.session.access_token);
  return data;
}

/** Join a private channel and collect `rating_received` payloads. Resolves once subscribed. */
function listen(client: SupabaseClient<Database>, topic: string, received: unknown[]) {
  return new Promise<RealtimeChannel>((resolve, reject) => {
    const channel = client
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event: 'rating_received' }, (message) => received.push(message.payload))
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') resolve(channel);
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(err ?? new Error(status));
      });
  });
}

async function waitFor(check: () => boolean, ms = 5000) {
  const until = Date.now() + ms;
  while (!check() && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
}

describe('driver rating', () => {
  const env = mobileEnv();
  let sureshClient: SupabaseClient<Database>;
  let imranClient: SupabaseClient<Database>;
  let rahulClient: SupabaseClient<Database>;
  let tripId: string | undefined;
  const sureshReceived: unknown[] = [];
  const imranReceived: unknown[] = [];

  beforeAll(async () => {
    sureshClient = anonClient(env);
    imranClient = anonClient(env);
    rahulClient = anonClient(env);
    await signIn(sureshClient, 'suresh@sawaribuddy.local');
    await signIn(imranClient, 'imran@sawaribuddy.local');
    await signIn(rahulClient, 'rahul@sawaribuddy.local');
  });

  afterAll(async () => {
    if (tripId) await sureshClient.rpc('cancel_trip', { p_trip_id: tripId, p_reason: 'DRIVER_CANCELLED' });
    await Promise.all([sureshClient.removeAllChannels(), imranClient.removeAllChannels()]);
  });

  it('Suresh rides Rahul to the end of the route', async () => {
    const { data: trip, error } = await sureshClient.rpc('open_trip', { p_auto_id: SURESH_AUTO_ID, p_route_id: ROUTE_1 });
    expect(error).toBeNull();
    tripId = (trip as { id: string }).id;
    await sureshClient.rpc('driver_heartbeat', { p_lat: 28.57, p_lng: 77.33, p_accuracy_m: 5 });

    const { data: booking, error: bookErr } = await rahulClient.rpc('book_seats', {
      p_trip_id: tripId,
      p_seat_count: 1,
      p_idempotency_key: crypto.randomUUID(),
    });
    expect(bookErr).toBeNull();
    const bookingId = (booking as { id: string }).id;
    const { data: mine } = await rahulClient.rpc('get_my_booking', { p_booking_id: bookingId });
    const pin = (mine as { boarding_pin: string }).boarding_pin;

    expect((await sureshClient.rpc('board_with_pin', { p_trip_id: tripId, p_pin: pin })).error).toBeNull();
    expect((await sureshClient.rpc('start_trip', { p_trip_id: tripId })).error).toBeNull();
    expect((await sureshClient.rpc('drop_off_passenger', { p_booking_id: bookingId, p_received: true })).error).toBeNull();
    expect((await sureshClient.rpc('complete_trip', { p_trip_id: tripId })).error).toBeNull();
    tripId = undefined;
  });

  it('Suresh hears about a new rating on his own channel; Imran listening there hears nothing', async () => {
    const before = await sureshClient.rpc('get_my_driver_rating');
    expect(before.error).toBeNull();
    const countBefore = (before.data as { count: number }).count;

    await listen(sureshClient, `driver:${SURESH_ID}`, sureshReceived);
    await listen(imranClient, `driver:${SURESH_ID}`, imranReceived).catch(() => undefined);

    const { data: pending } = await rahulClient.rpc('get_my_pending_rating');
    const bookingId = (pending as { booking_id: string }).booking_id;
    expect((await rahulClient.rpc('rate_booking', { p_booking_id: bookingId, p_stars: 4 })).error).toBeNull();

    await waitFor(() => sureshReceived.length > 0);
    expect(sureshReceived).toEqual([expect.objectContaining({ stars: 4, count: countBefore + 1 })]);
    expect(imranReceived).toEqual([]);

    const after = await sureshClient.rpc('get_my_driver_rating');
    expect((after.data as { count: number }).count).toBe(countBefore + 1);
  });
});
