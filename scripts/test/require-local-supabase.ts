/// <reference types="node" />
// Integration tests create users, trips and bookings, and their cleanup runs against the LOCAL
// database. apps/mobile/.env.local can point at the hosted project (`pnpm mobile:env:staging`), so
// refuse to run unless it points at this machine or the local network.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const file = readFileSync(join(__dirname, '..', '..', 'apps', 'mobile', '.env.local'), 'utf8');
const url = file.match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim() ?? '';
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
})();
const isLocal =
  host === 'localhost' ||
  /^127\./.test(host) ||
  /^10\./.test(host) ||
  /^192\.168\./.test(host) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(host);

if (!isLocal) {
  throw new Error(
    `Integration tests only run against local Supabase, but apps/mobile/.env.local points at ${url || '(nothing)'}. ` +
      'Run `pnpm mobile:env` to switch back to local first.',
  );
}
