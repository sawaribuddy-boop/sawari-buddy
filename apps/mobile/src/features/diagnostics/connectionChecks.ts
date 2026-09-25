// Development connection diagnostics: can this phone reach the Supabase instance on the Mac?
// Each check exercises a different path the real app depends on: Auth (HTTP), the database via the
// API (RPC), and Realtime (WebSocket).

import type { AppEnv } from '@/lib/env';
import type { AppSupabaseClient } from '@/lib/supabase';

export type CheckStatus = 'pass' | 'fail';

export interface CheckResult {
  id: 'auth' | 'database' | 'realtime';
  label: string;
  status: CheckStatus;
  latencyMs: number | null;
  detail: string;
}

export interface DiagnosticsReport {
  checks: CheckResult[];
  /** server_time − phone time, in ms (positive = phone clock is behind). Null if the DB check failed. */
  clockSkewMs: number | null;
  ranAt: Date;
}

const TIMEOUT_MS = 8000;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function networkHint(env: AppEnv, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|timed? ?out/i.test(message)) {
    return `Timed out reaching ${hostOf(env.supabaseUrl)}. Is the phone on the same Wi-Fi as the Mac, and is Supabase running (pnpm db:start)?`;
  }
  if (/network request failed|failed to fetch|network/i.test(message)) {
    return `Cannot reach ${hostOf(env.supabaseUrl)}. Same Wi-Fi? Has the Mac's IP changed (re-run pnpm mobile:env)? On iPhone, allow Expo Go "Local Network" access in Settings.`;
  }
  return message;
}

async function timed<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<{ value: T; ms: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const value = await fn(controller.signal);
    return { value, ms: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkAuth(env: AppEnv): Promise<CheckResult> {
  const label = 'Auth service (HTTP)';
  try {
    const { value: res, ms } = await timed((signal) =>
      fetch(`${env.supabaseUrl}/auth/v1/health`, { headers: { apikey: env.supabaseAnonKey }, signal }),
    );
    return res.ok
      ? { id: 'auth', label, status: 'pass', latencyMs: ms, detail: `HTTP ${res.status}` }
      : { id: 'auth', label, status: 'fail', latencyMs: ms, detail: `Unexpected HTTP ${res.status}` };
  } catch (e) {
    return { id: 'auth', label, status: 'fail', latencyMs: null, detail: networkHint(env, e) };
  }
}

export async function checkDatabase(
  env: AppEnv,
  client: AppSupabaseClient,
): Promise<{ result: CheckResult; clockSkewMs: number | null }> {
  const label = 'Database via API (RPC)';
  try {
    const { value, ms } = await timed(async (signal) => await client.rpc('get_server_status').abortSignal(signal));
    if (value.error) {
      return { result: { id: 'database', label, status: 'fail', latencyMs: ms, detail: value.error.message }, clockSkewMs: null };
    }
    const data = value.data as { server_time?: string } | null;
    const serverTime = data?.server_time ? new Date(data.server_time).getTime() : NaN;
    // Estimate the phone time at which the server answered: midpoint of the round trip.
    const phoneTimeAtServer = Date.now() - ms / 2;
    const skew = Number.isFinite(serverTime) ? Math.round(serverTime - phoneTimeAtServer) : null;
    return {
      result: { id: 'database', label, status: 'pass', latencyMs: ms, detail: `Server time ${data?.server_time ?? 'unknown'}` },
      clockSkewMs: skew,
    };
  } catch (e) {
    return { result: { id: 'database', label, status: 'fail', latencyMs: null, detail: networkHint(env, e) }, clockSkewMs: null };
  }
}

export async function checkRealtime(env: AppEnv, client: AppSupabaseClient): Promise<CheckResult> {
  const label = 'Realtime (WebSocket)';
  const start = Date.now();
  const channel = client.channel(`diagnostics-${Math.random().toString(36).slice(2, 10)}`);
  try {
    const status = await new Promise<string>((resolve) => {
      const timer = setTimeout(() => resolve('TIMED_OUT'), TIMEOUT_MS);
      channel.subscribe((s) => {
        if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          clearTimeout(timer);
          resolve(s);
        }
      });
    });
    const ms = Date.now() - start;
    return status === 'SUBSCRIBED'
      ? { id: 'realtime', label, status: 'pass', latencyMs: ms, detail: 'Subscribed to a test channel' }
      : { id: 'realtime', label, status: 'fail', latencyMs: ms, detail: `${status}. ${networkHint(env, new Error('network'))}` };
  } finally {
    await client.removeChannel(channel);
  }
}

export async function runDiagnostics(env: AppEnv, client: AppSupabaseClient): Promise<DiagnosticsReport> {
  const [auth, db, realtime] = await Promise.all([checkAuth(env), checkDatabase(env, client), checkRealtime(env, client)]);
  return { checks: [auth, db.result, realtime], clockSkewMs: db.clockSkewMs, ranAt: new Date() };
}
