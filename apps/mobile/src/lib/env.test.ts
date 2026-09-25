/// <reference types="node" />
import { describe, expect, it } from 'vitest';

import { validateEnv } from './env';

const jwt = (payload: object) =>
  ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.');

describe('validateEnv', () => {
  it('accepts a LAN URL with the anon key and trims a trailing slash', () => {
    const result = validateEnv({ url: 'http://192.168.1.82:55321/', anonKey: jwt({ role: 'anon' }) });
    expect(result).toEqual({
      ok: true,
      env: { supabaseUrl: 'http://192.168.1.82:55321', supabaseAnonKey: jwt({ role: 'anon' }) },
      warnings: [],
    });
  });

  it('reports missing values', () => {
    const result = validateEnv({ url: undefined, anonKey: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toHaveLength(2);
  });

  it('rejects an invalid URL', () => {
    expect(validateEnv({ url: 'not a url', anonKey: jwt({ role: 'anon' }) }).ok).toBe(false);
  });

  it('rejects a service-role JWT', () => {
    const result = validateEnv({ url: 'http://192.168.1.82:55321', anonKey: jwt({ role: 'service_role' }) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toMatch(/service-role/);
  });

  it('rejects a secret API key', () => {
    expect(validateEnv({ url: 'http://192.168.1.82:55321', anonKey: 'sb_secret_abc123' }).ok).toBe(false);
  });

  it('warns that localhost is unreachable from a physical phone', () => {
    const result = validateEnv({ url: 'http://127.0.0.1:55321', anonKey: jwt({ role: 'anon' }) });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings[0]).toMatch(/physical phone/);
  });
});
