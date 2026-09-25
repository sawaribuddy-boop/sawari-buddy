import 'react-native-url-polyfill/auto';

import type { Database } from '@sawari/types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { envResult } from './env';

export type AppSupabaseClient = SupabaseClient<Database>;

/**
 * The app's single Supabase client (anon key only). Null when configuration is missing/invalid,
 * so screens can show a clear setup message instead of crashing.
 *
 * Step 2: no session persistence yet. Step 3 adds encrypted session storage and token refresh.
 */
export const supabase: AppSupabaseClient | null = envResult.ok
  ? createClient<Database>(envResult.env.supabaseUrl, envResult.env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;
