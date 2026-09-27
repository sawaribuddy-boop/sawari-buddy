// Public runtime configuration. EXPO_PUBLIC_* values are inlined into the app bundle at build time,
// so they must only ever contain PUBLIC values. The service-role key must never appear here:
// validateEnv rejects it outright.

export interface AppEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export type EnvResult = { ok: true; env: AppEnv; warnings: string[] } | { ok: false; problems: string[] };

interface RawEnv {
  url: string | undefined;
  anonKey: string | undefined;
}

function jwtRole(token: string): string | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const payload: unknown = JSON.parse(atob(base64));
    return typeof payload === 'object' && payload !== null && 'role' in payload && typeof payload.role === 'string'
      ? payload.role
      : null;
  } catch {
    return null;
  }
}

export function validateEnv({ url, anonKey }: RawEnv): EnvResult {
  const problems: string[] = [];
  const warnings: string[] = [];

  if (!url) problems.push('EXPO_PUBLIC_SUPABASE_URL is not set.');
  if (!anonKey) problems.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set.');

  let parsed: URL | null = null;
  if (url) {
    try {
      parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') problems.push('EXPO_PUBLIC_SUPABASE_URL must be http(s).');
    } catch {
      problems.push(`EXPO_PUBLIC_SUPABASE_URL is not a valid URL: ${url}`);
    }
  }

  if (anonKey) {
    if (anonKey.startsWith('sb_secret_') || jwtRole(anonKey) === 'service_role') {
      problems.push('EXPO_PUBLIC_SUPABASE_ANON_KEY holds a SECRET/service-role key. Use the anon key only.');
    }
  }

  if (parsed && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')) {
    warnings.push('The Supabase URL points at localhost. A physical phone cannot reach it; run `pnpm mobile:env`.');
  }

  if (problems.length > 0 || !url || !anonKey) return { ok: false, problems };
  return { ok: true, env: { supabaseUrl: url.replace(/\/+$/, ''), supabaseAnonKey: anonKey }, warnings };
}

// Must be referenced literally (process.env.EXPO_PUBLIC_…) for Expo to inline the values.
export const envResult: EnvResult = validateEnv({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});
