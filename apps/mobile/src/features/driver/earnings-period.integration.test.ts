/// <reference types="node" />
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

describe('Step 7b earnings period', () => {
  const RAJ_AUTO_ID = '00000000-0000-4000-b000-000000000102';
  const ROUTE_1 = '00000000-0000-4000-d000-000000000001';

  let rajClient: SupabaseClient<Database>;

  beforeAll(async () => {
    const env = mobileEnv();
    rajClient = anonClient(env);
    await signIn(rajClient, 'raj.kumar@sawaribuddy.local');
  });

  afterAll(async () => {
    await rajClient.auth.signOut();
  });

  it('returns today earnings with no params (RPC default)', async () => {
    const { data, error } = await rajClient.rpc('driver_earnings_summary');
    expect(error).toBeNull();
    const result = data as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(typeof result.earnings_paise).toBe('number');
    expect(typeof result.fares_collected_paise).toBe('number');
    expect(typeof result.completed_trips).toBe('number');
    expect(typeof result.settlement_balance_paise).toBe('number');
  });

  it('returns scoped earnings with explicit from/to', async () => {
    const from = '2020-01-01T00:00:00+05:30';
    const to = '2020-01-02T00:00:00+05:30';
    const { data, error } = await rajClient.rpc('driver_earnings_summary', {
      p_from: from,
      p_to: to,
    });
    expect(error).toBeNull();
    const result = data as Record<string, unknown>;
    expect(result.earnings_paise).toBe(0);
    expect(result.fares_collected_paise).toBe(0);
    expect(result.completed_trips).toBe(0);
  });

  it('returns all-time earnings with epoch from', async () => {
    const { data, error } = await rajClient.rpc('driver_earnings_summary', {
      p_from: '1970-01-01T00:00:00+05:30',
    });
    expect(error).toBeNull();
    const result = data as Record<string, unknown>;
    expect(typeof result.earnings_paise).toBe('number');
    expect(typeof result.completed_trips).toBe('number');
  });

  it('completes a trip and verifies earnings update', async () => {
    const { data: tripData } = await rajClient.rpc('open_trip', {
      p_auto_id: RAJ_AUTO_ID,
      p_route_id: ROUTE_1,
    });
    const trip = tripData as Record<string, unknown>;
    const tripId = trip.id as string;

    const { data: walkInData } = await rajClient.rpc('add_walk_in', {
      p_trip_id: tripId,
      p_seat_count: 1 as unknown as number,
      p_idempotency_key: crypto.randomUUID(),
    });
    const walkIn = walkInData as Record<string, unknown>;
    const bookingId = walkIn.id as string;

    await rajClient.rpc('mark_boarded', { p_booking_id: bookingId });
    await rajClient.rpc('start_trip', { p_trip_id: tripId });
    await rajClient.rpc('complete_trip', { p_trip_id: tripId });

    const { data: earningsData } = await rajClient.rpc('driver_earnings_summary');
    const earnings = earningsData as Record<string, unknown>;
    expect((earnings.completed_trips as number)).toBeGreaterThanOrEqual(1);
    expect((earnings.fares_collected_paise as number)).toBeGreaterThan(0);
  });
});
