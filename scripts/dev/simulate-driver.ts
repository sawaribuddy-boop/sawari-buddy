#!/usr/bin/env tsx
//
// Headless driver simulator for SawariBuddy.
// Authenticates as a seed driver, opens a trip, sends heartbeats,
// adds a walk-in, boards them, starts, heartbeats some more, completes.
//
// Usage:
//   SIM_DRIVER_EMAIL=raj.kumar@sawaribuddy.local SIM_DRIVER_PASSWORD=SawariDev#2026 pnpm simulate:driver
//   SIM_DRIVER_EMAIL=... SIM_DRIVER_PASSWORD=... pnpm simulate:driver --heartbeat-only
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL   — local Supabase API URL
//   EXPO_PUBLIC_SUPABASE_ANON_KEY — anon key (never service-role)
//   SIM_DRIVER_EMAIL           — driver account email
//   SIM_DRIVER_PASSWORD        — driver account password

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const DRIVER_EMAIL = process.env.SIM_DRIVER_EMAIL;
const DRIVER_PASSWORD = process.env.SIM_DRIVER_PASSWORD;

const missing: string[] = [];
if (!SUPABASE_URL) missing.push('EXPO_PUBLIC_SUPABASE_URL');
if (!SUPABASE_ANON_KEY) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
if (!DRIVER_EMAIL) missing.push('SIM_DRIVER_EMAIL');
if (!DRIVER_PASSWORD) missing.push('SIM_DRIVER_PASSWORD');
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Example: SIM_DRIVER_EMAIL=raj.kumar@sawaribuddy.local SIM_DRIVER_PASSWORD=SawariDev#2026 pnpm simulate:driver');
  process.exit(1);
}

const heartbeatOnly = process.argv.includes('--heartbeat-only');
const routeOverride = process.argv.find((a) => a.startsWith('--route='))?.split('=')[1];
const durationS = Number(process.env.SIM_DURATION_S) || 60;
const heartbeatIntervalS = 10;
const heartbeatsBeforeStart = Math.max(1, Math.floor(durationS / heartbeatIntervalS / 2));

const BASE_LAT = 28.6139;
const BASE_LNG = 77.2090;

function jitter(): { lat: number; lng: number; accuracy: number } {
  return {
    lat: BASE_LAT + (Math.random() - 0.5) * 0.002,
    lng: BASE_LNG + (Math.random() - 0.5) * 0.002,
    accuracy: 10 + Math.random() * 20,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function unwrap<T>(promise: Promise<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Sign in
  console.log(`Signing in as ${DRIVER_EMAIL}...`);
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: DRIVER_EMAIL!,
    password: DRIVER_PASSWORD!,
  });
  if (authError) {
    console.error('Auth failed:', authError.message);
    process.exit(1);
  }
  console.log('Signed in.');

  // 2. Check for active trip
  const home = (await unwrap(supabase.rpc('get_driver_home'))) as Record<string, unknown>;
  const activeTrip = home.active_trip as Record<string, unknown> | null;
  const auto = home.auto as { id: string; registration_number: string } | null;

  if (!auto) {
    console.error('No auto assigned to this driver. Exiting.');
    await supabase.auth.signOut();
    process.exit(1);
  }

  if (activeTrip) {
    console.error(`Driver already has an active trip. Cancel or complete it first. Exiting.`);
    await supabase.auth.signOut();
    process.exit(1);
  }

  // 3. Pick route
  const routeId = routeOverride ?? '00000000-0000-4000-d000-000000000001';
  console.log(`Opening trip on auto ${auto.registration_number}, route ${routeId}...`);

  const trip = (await unwrap(supabase.rpc('open_trip', {
    p_auto_id: auto.id,
    p_route_id: routeId,
  }))) as Record<string, unknown>;
  const tripId = trip.id as string;
  console.log(`Trip opened: ${tripId}`);

  // 4. Heartbeat function
  let heartbeatCount = 0;
  async function sendHeartbeat() {
    const loc = jitter();
    try {
      await unwrap(supabase.rpc('driver_heartbeat', {
        p_lat: loc.lat,
        p_lng: loc.lng,
        p_accuracy_m: loc.accuracy,
      }));
      heartbeatCount++;
      console.log(`  heartbeat #${heartbeatCount} (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`);
    } catch (err: unknown) {
      console.warn(`  heartbeat failed:`, err instanceof Error ? err.message : err);
    }
  }

  // Handle Ctrl+C
  let interrupted = false;
  process.on('SIGINT', () => {
    console.log('\nInterrupted. Cleaning up...');
    interrupted = true;
  });

  if (heartbeatOnly) {
    console.log('Heartbeat-only mode. Press Ctrl+C to stop.');
    while (!interrupted) {
      await sendHeartbeat();
      await sleep(heartbeatIntervalS * 1000);
    }
    console.log('Going offline...');
    try {
      await unwrap(supabase.rpc('go_offline'));
    } catch {
      // may fail if trip has passengers
    }
    await supabase.auth.signOut();
    console.log('Done.');
    process.exit(0);
  }

  // 5. Heartbeat loop (phase 1: before start)
  console.log(`Sending ${heartbeatsBeforeStart} heartbeats before starting trip...`);
  for (let i = 0; i < heartbeatsBeforeStart && !interrupted; i++) {
    await sendHeartbeat();
    await sleep(heartbeatIntervalS * 1000);
  }

  if (interrupted) {
    await supabase.auth.signOut();
    process.exit(0);
  }

  // 6. Add walk-in → mark boarded → start trip
  const idempotencyKey = crypto.randomUUID();
  console.log('Adding walk-in passenger...');
  const walkIn = (await unwrap(supabase.rpc('add_walk_in', {
    p_trip_id: tripId,
    p_seat_count: 1 as unknown as number,
    p_idempotency_key: idempotencyKey,
  }))) as Record<string, unknown>;
  const bookingId = walkIn.id as string;
  console.log(`Walk-in added: ${bookingId}`);

  console.log('Marking walk-in as boarded...');
  await unwrap(supabase.rpc('mark_boarded', { p_booking_id: bookingId }));
  console.log('Walk-in boarded.');

  console.log('Starting trip...');
  await unwrap(supabase.rpc('start_trip', { p_trip_id: tripId }));
  console.log('Trip started (IN_PROGRESS).');

  // 7. Heartbeat loop (phase 2: during trip)
  const heartbeatsAfterStart = Math.max(1, Math.floor(heartbeatsBeforeStart / 2));
  console.log(`Sending ${heartbeatsAfterStart} more heartbeats...`);
  for (let i = 0; i < heartbeatsAfterStart && !interrupted; i++) {
    await sendHeartbeat();
    await sleep(heartbeatIntervalS * 1000);
  }

  if (interrupted) {
    await supabase.auth.signOut();
    process.exit(0);
  }

  // 8. Complete trip
  console.log('Completing trip...');
  await unwrap(supabase.rpc('complete_trip', { p_trip_id: tripId }));
  console.log('Trip completed.');

  // 9. Show earnings
  const earnings = (await unwrap(supabase.rpc('driver_earnings_summary'))) as Record<string, unknown>;
  console.log('\nToday\'s earnings:');
  console.log(`  Trips completed: ${earnings.completed_trips}`);
  console.log(`  Fares collected: ${(earnings.fares_collected_paise as number) / 100}`);
  console.log(`  Net earnings:    ${(earnings.earnings_paise as number) / 100}`);

  await supabase.auth.signOut();
  console.log('\nDone. Driver signed out.');
}

main().catch((err) => {
  console.error('Simulator error:', err);
  process.exit(1);
});
