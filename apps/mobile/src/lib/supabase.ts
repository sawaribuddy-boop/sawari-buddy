import 'react-native-url-polyfill/auto';

import type { Database } from '@sawari/types';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';

import { envResult } from './env';
import { secureSessionStorage } from './secureStorage';

export type AppSupabaseClient = SupabaseClient<Database>;

export const SESSION_STORAGE_KEY = 'sawari.auth';

/**
 * The app's single Supabase client (anon key only). Null when configuration is missing/invalid,
 * so screens can show a clear setup message instead of crashing.
 *
 * Sessions persist in encrypted OS storage and survive app restarts. Token auto-refresh is started
 * and stopped with the app's foreground state by the AuthProvider.
 */
export const supabase: AppSupabaseClient | null = envResult.ok
  ? createClient<Database>(envResult.env.supabaseUrl, envResult.env.supabaseAnonKey, {
      auth: {
        storage: secureSessionStorage,
        storageKey: SESSION_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
  : null;
