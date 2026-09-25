/// <reference types="node" />
// Real Supabase Auth over the Mac's LAN address, using the app's own auth modules
// (chunked session storage, account loading, error mapping). Requires `pnpm db:start` + `pnpm mobile:env`.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from '@sawari/types';
import { createClient } from '@supabase/supabase-js';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { connect } from '../../../../../supabase/tests/concurrency/db';

import { createChunkedStorage, type KeyValueBackend } from '@/lib/chunkedStorage';
import { validateEnv } from '@/lib/env';

import { loadAccount } from './account';
import { authErrorMessage } from './authErrors';

const SEED_PASSWORD = 'SawariDev#2026';
const STORAGE_KEY = 'sawari.auth';

function mobileEnv() {
  const file = readFileSync(join(__dirname, '..', '..', '..', '.env.local'), 'utf8');
  const get = (k: string) => file.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1];
  const result = validateEnv({ url: get('EXPO_PUBLIC_SUPABASE_URL'), anonKey: get('EXPO_PUBLIC_SUPABASE_ANON_KEY') });
  if (!result.ok) throw new Error(result.problems.join(' '));
  return result.env;
}

/** A "device": its own storage, and a client configured like the app's (persisted session, no auto refresh in tests). */
function device(env: ReturnType<typeof mobileEnv>, map = new Map<string, string>()) {
  const backend: KeyValueBackend = {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    deleteItem: async (k) => void map.delete(k),
  };
  const client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { storage: createChunkedStorage(backend), storageKey: STORAGE_KEY, persistSession: true, autoRefreshToken: false },
  });
  return { client, map };
}

describe('mobile auth against local Supabase (LAN)', () => {
  const env = mobileEnv();
  let admin: pg.Client;
  const email = `passenger-${randomUUID().slice(0, 8)}@test.local`;
  const password = 'correct-horse-battery';
  let newUserId: string | null = null;

  beforeAll(async () => {
    admin = await connect();
  });

  afterAll(async () => {
    if (newUserId) await admin.query('delete from auth.users where id = $1', [newUserId]);
    await admin.end();
  });

  it('signs up a passenger: PASSENGER profile from the trigger, session persisted in chunked storage', async () => {
    const { client, map } = device(env);
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: 'Test Passenger' } } });
    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
    newUserId = data.user!.id;

    expect(map.has(`${STORAGE_KEY}.n`)).toBe(true);
    expect(await loadAccount(client, newUserId)).toEqual({
      kind: 'ok',
      account: { userId: newUserId, role: 'PASSENGER', fullName: 'Test Passenger', email, driverStatus: null },
    });
  });

  it('restores the session on "app restart" (new client, same storage) and signs out cleanly', async () => {
    const first = device(env);
    const { error } = await first.client.auth.signInWithPassword({ email, password });
    expect(error).toBeNull();

    const restarted = device(env, first.map); // same device storage, fresh process
    const { data } = await restarted.client.auth.getSession();
    expect(data.session?.user.id).toBe(newUserId);

    const { error: outError } = await restarted.client.auth.signOut({ scope: 'local' });
    expect(outError).toBeNull();
    expect([...first.map.keys()].filter((k) => k.startsWith(STORAGE_KEY))).toEqual([]);
    expect((await device(env, first.map).client.auth.getSession()).data.session).toBeNull();
  });

  it('rejects a wrong password with a safe message', async () => {
    const { client } = device(env);
    const { error } = await client.auth.signInWithPassword({ email, password: 'wrong-password' });
    expect(error?.code).toBe('invalid_credentials');
    expect(authErrorMessage(error)).toBe('Email or password is incorrect.');
  });

  it('rejects a duplicate sign-up', async () => {
    const { client } = device(env);
    const { error } = await client.auth.signUp({ email, password });
    expect(authErrorMessage(error)).toMatch(/already exists/);
  });

  it('does not let a passenger change their own role', async () => {
    const { client } = device(env);
    await client.auth.signInWithPassword({ email, password });
    const { error } = await client.from('profiles').update({ role: 'DRIVER' }).eq('id', newUserId!);
    expect(error?.code).toBe('42501');
    expect((await loadAccount(client, newUserId!)).kind === 'ok' && (await loadAccount(client, newUserId!))).toMatchObject({
      account: { role: 'PASSENGER' },
    });
  });

  it('blocks a suspended account', async () => {
    await admin.query("update public.profiles set status = 'SUSPENDED' where id = $1", [newUserId]);
    try {
      const { client } = device(env);
      const { error } = await client.auth.signInWithPassword({ email, password });
      expect(error).toBeNull(); // Supabase Auth itself allows it…
      expect(await loadAccount(client, newUserId!)).toEqual({ kind: 'blocked', reason: 'ACCOUNT_SUSPENDED' }); // …the app does not
    } finally {
      await admin.query("update public.profiles set status = 'ACTIVE' where id = $1", [newUserId]);
    }
  });

  it('routes the seeded driver into driver mode', async () => {
    const { client } = device(env);
    const { data, error } = await client.auth.signInWithPassword({ email: 'raj.kumar@sawaribuddy.local', password: SEED_PASSWORD });
    expect(error).toBeNull();
    expect(await loadAccount(client, data.user!.id)).toMatchObject({
      kind: 'ok',
      account: { role: 'DRIVER', fullName: 'Raj Kumar', driverStatus: 'ACTIVE' },
    });
  });

  it('keeps admins out of the mobile app', async () => {
    const { client } = device(env);
    const { data } = await client.auth.signInWithPassword({ email: 'admin@sawaribuddy.local', password: SEED_PASSWORD });
    expect(await loadAccount(client, data.user!.id)).toEqual({ kind: 'blocked', reason: 'ADMIN_NOT_SUPPORTED' });
  });
});
