/// <reference types="node" />
// Runs the exact diagnostics the phone runs, from this Mac, against Supabase via the Mac's LAN IP
// (not 127.0.0.1). Proves the stack is reachable on the LAN interface. The phone-side proof is the
// in-app Connection check screen. Requires `pnpm db:start` and `pnpm mobile:env`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from '@sawari/types';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { validateEnv } from '@/lib/env';

import { runDiagnostics } from './connectionChecks';

function readMobileEnv(): Record<string, string> {
  const file = readFileSync(join(__dirname, '..', '..', '..', '.env.local'), 'utf8');
  return Object.fromEntries(
    file
      .split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
}

describe('connection diagnostics over the LAN', () => {
  it('reaches Auth, the database and Realtime through the Mac LAN address', async () => {
    const raw = readMobileEnv();
    const result = validateEnv({ url: raw.EXPO_PUBLIC_SUPABASE_URL, anonKey: raw.EXPO_PUBLIC_SUPABASE_ANON_KEY });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new URL(result.env.supabaseUrl).hostname).not.toMatch(/^(127\.0\.0\.1|localhost)$/);

    const client = createClient<Database>(result.env.supabaseUrl, result.env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const report = await runDiagnostics(result.env, client);

    for (const check of report.checks) {
      expect(check, `${check.label}: ${check.detail}`).toMatchObject({ status: 'pass' });
    }
    expect(report.clockSkewMs).not.toBeNull();
    client.realtime.disconnect();
  });
});
