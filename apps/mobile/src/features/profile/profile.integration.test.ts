/// <reference types="node" />
// Profile section against local Supabase over the Mac's LAN address: edit profile, change password,
// reset password with the emailed 6-digit code (read from Mailpit), report a problem.
// Requires `pnpm db:start` + `pnpm mobile:env`. The reset email counts against [auth.rate_limit].email_sent.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from '@sawari/types';
import { editProfileInput } from '@sawari/validation';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { connect } from '../../../../../supabase/tests/concurrency/db';

import { loadAccount } from '@/features/auth/account';
import { raiseIssue, updateMyProfile } from '@/lib/api';
import { validateEnv } from '@/lib/env';

import { updateProfileErrorMessage } from './profileErrors';

const MAILPIT = 'http://127.0.0.1:55324';

function mobileEnv() {
  const file = readFileSync(join(__dirname, '..', '..', '..', '.env.local'), 'utf8');
  const get = (k: string) => file.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1];
  const result = validateEnv({ url: get('EXPO_PUBLIC_SUPABASE_URL'), anonKey: get('EXPO_PUBLIC_SUPABASE_ANON_KEY') });
  if (!result.ok) throw new Error(result.problems.join(' '));
  return result.env;
}

function newClient(env: ReturnType<typeof mobileEnv>): SupabaseClient<Database> {
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Poll Mailpit for the newest email to `to` and return its 6-digit code. */
async function resetCodeFor(to: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=1`);
    const body = (await res.json()) as { messages?: { ID: string }[] };
    const id = body.messages?.[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Text?: string; HTML?: string };
      const code = /\b(\d{6})\b/.exec(`${msg.Text ?? ''} ${msg.HTML ?? ''}`)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No reset email for ${to}`);
}

describe('profile section against local Supabase (LAN)', () => {
  const env = mobileEnv();
  let admin: pg.Client;
  const userIds: string[] = [];

  async function signUpPassenger(fullName: string) {
    const client = newClient(env);
    const email = `profile-${randomUUID().slice(0, 8)}@test.local`;
    const password = 'first-Password-1';
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    expect(error).toBeNull();
    userIds.push(data.user!.id);
    return { client, email, password, userId: data.user!.id };
  }

  beforeAll(async () => {
    admin = await connect();
  });

  afterAll(async () => {
    if (userIds.length) {
      await admin.query('delete from public.issues where raised_by = any($1::uuid[])', [userIds]);
      await admin.query('delete from auth.users where id = any($1::uuid[])', [userIds]);
    }
    await admin.end();
  });

  it('edits name and phone, and reports a phone that another account already uses', async () => {
    const a = await signUpPassenger('Asha Rao');
    const b = await signUpPassenger('Bilal Khan');
    const phone = `+9198${String(Date.now()).slice(-8)}`;

    const input = editProfileInput.parse({ fullName: '  Asha R. ', phone: `${phone.slice(3, 8)} ${phone.slice(8)}` });
    await updateMyProfile(a.client, a.userId, input);
    const account = await loadAccount(a.client, a.userId);
    expect(account.kind === 'ok' && account.account).toMatchObject({ fullName: 'Asha R.', phone });

    const clash = await updateMyProfile(b.client, b.userId, { fullName: 'Bilal Khan', phone }).catch((e: unknown) => e);
    expect(updateProfileErrorMessage(clash as { code?: string })).toBe('This mobile number is already used by another account.');
  });

  it('changes the password after re-checking the current one', async () => {
    const u = await signUpPassenger('Chitra Das');
    const wrong = await u.client.auth.signInWithPassword({ email: u.email, password: 'not-my-password' });
    expect(wrong.error?.code).toBe('invalid_credentials');

    expect((await u.client.auth.signInWithPassword({ email: u.email, password: u.password })).error).toBeNull();
    expect((await u.client.auth.updateUser({ password: 'second-Password-2' })).error).toBeNull();

    const fresh = newClient(env);
    expect((await fresh.auth.signInWithPassword({ email: u.email, password: u.password })).error?.code).toBe('invalid_credentials');
    expect((await fresh.auth.signInWithPassword({ email: u.email, password: 'second-Password-2' })).error).toBeNull();
  });

  it('resets a forgotten password with the 6-digit code from the email', async () => {
    const u = await signUpPassenger('Dev Malhotra');
    const device = newClient(env);
    expect((await device.auth.resetPasswordForEmail(u.email)).error).toBeNull();
    const code = await resetCodeFor(u.email);

    const bad = await device.auth.verifyOtp({ email: u.email, token: code === '000000' ? '111111' : '000000', type: 'recovery' });
    expect(bad.error?.code).toBe('otp_expired');

    const verified = await device.auth.verifyOtp({ email: u.email, token: code, type: 'recovery' });
    expect(verified.error).toBeNull();
    expect((await device.auth.updateUser({ password: 'reset-Password-3' })).error).toBeNull();
    expect((await newClient(env).auth.signInWithPassword({ email: u.email, password: 'reset-Password-3' })).error).toBeNull();
  });

  it('sends a problem report to support', async () => {
    const u = await signUpPassenger('Esha Nair');
    const issue = await raiseIssue(u.client, { kind: 'PAYMENT', description: 'I was charged twice for one ride.' });
    expect(issue).toMatchObject({ source: 'PASSENGER', kind: 'PAYMENT', raised_by: u.userId, status: 'OPEN' });
  });
});
