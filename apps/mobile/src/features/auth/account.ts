// Loads the signed-in user's account from the database (source of truth: profiles.role / status,
// drivers.status under Phase 1 RLS) and decides whether the mobile app may be used.

import type { Enums } from '@sawari/types';

import type { AppSupabaseClient } from '@/lib/supabase';

export type MobileRole = 'PASSENGER' | 'DRIVER';

export interface Account {
  userId: string;
  role: MobileRole;
  fullName: string;
  email: string | null;
  /** The verified number, or (before verification was required) one saved on the profile. */
  phone: string | null;
  phoneVerified: boolean;
  /** The app must verify a number before anything else (platform_settings.phone_verification_required). */
  phoneRequired: boolean;
  /** The number typed at sign-up, to prefill verification. */
  signupPhone: string | null;
  /** Only for drivers. */
  licenseNumber: string | null;
  /** Only for drivers. Non-ACTIVE drivers can sign in but the server refuses driver actions. */
  driverStatus: Enums<'driver_status'> | null;
}

/** Signed in, but the app stays on phone verification until a number is verified. */
export function needsPhoneVerification(account: Account | null): boolean {
  return !!account && account.phoneRequired && !account.phoneVerified;
}

/** Why a signed-in user is not allowed into the app. They are signed out and shown this on the login screen. */
export type BlockReason = 'ACCOUNT_SUSPENDED' | 'ADMIN_NOT_SUPPORTED' | 'PROFILE_MISSING' | 'DRIVER_RECORD_MISSING';

export type AccountResult =
  | { kind: 'ok'; account: Account }
  | { kind: 'blocked'; reason: BlockReason }
  | { kind: 'error'; message: string };

export const BLOCK_MESSAGES: Record<BlockReason, { title: string; message: string }> = {
  ACCOUNT_SUSPENDED: {
    title: 'Account suspended',
    message: 'Your SawariBuddy account has been suspended. Please contact support.',
  },
  ADMIN_NOT_SUPPORTED: {
    title: 'Admin account',
    message: 'Admin accounts use the SawariBuddy web dashboard, not the mobile app.',
  },
  PROFILE_MISSING: {
    title: 'Account not found',
    message: 'We could not find your account. Please sign up again or contact support.',
  },
  DRIVER_RECORD_MISSING: {
    title: 'Driver setup incomplete',
    message: 'Your driver account is not set up yet. Please contact support.',
  },
};

export async function loadAccount(client: AppSupabaseClient, userId: string): Promise<AccountResult> {
  const { data: profile, error } = await client
    .from('profiles')
    .select('id, role, full_name, email, phone, status')
    .eq('id', userId)
    .maybeSingle();

  if (error) return { kind: 'error', message: error.message };
  if (!profile) return { kind: 'blocked', reason: 'PROFILE_MISSING' };
  if (profile.status !== 'ACTIVE') return { kind: 'blocked', reason: 'ACCOUNT_SUSPENDED' };
  if (profile.role === 'ADMIN') return { kind: 'blocked', reason: 'ADMIN_NOT_SUPPORTED' };

  let driverStatus: Enums<'driver_status'> | null = null;
  let licenseNumber: string | null = null;
  if (profile.role === 'DRIVER') {
    const { data: driver, error: driverError } = await client
      .from('drivers')
      .select('status, license_number')
      .eq('id', userId)
      .maybeSingle();
    if (driverError) return { kind: 'error', message: driverError.message };
    if (!driver) return { kind: 'blocked', reason: 'DRIVER_RECORD_MISSING' };
    driverStatus = driver.status;
    licenseNumber = driver.license_number;
  }

  const { data: phoneStatus, error: phoneError } = await client.rpc('get_my_phone_status');
  if (phoneError) return { kind: 'error', message: phoneError.message };
  const phone = (phoneStatus ?? {}) as { required?: boolean; verified?: boolean; phone?: string | null; signup_phone?: string | null };

  return {
    kind: 'ok',
    account: {
      userId,
      role: profile.role,
      fullName: profile.full_name,
      email: profile.email,
      phone: phone.phone ?? profile.phone,
      phoneVerified: phone.verified === true,
      phoneRequired: phone.required === true,
      signupPhone: phone.signup_phone ?? null,
      licenseNumber,
      driverStatus,
    },
  };
}
