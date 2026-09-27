import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { secureSessionStorage } from '@/lib/secureStorage';
import { SESSION_STORAGE_KEY, supabase } from '@/lib/supabase';

import { loadAccount, type Account, type BlockReason } from './account';
import { authErrorMessage } from './authErrors';
import type { AuthStatus } from './routing';

export interface AuthContextValue {
  status: AuthStatus;
  account: Account | null;
  /** Why the user was signed out (suspended, admin, …), shown on the login screen. */
  notice: BlockReason | null;
  /** Network/server problem while restoring the session (user stays signed in; can retry). */
  errorMessage: string | null;
  signIn(email: string, password: string): Promise<{ error: string | null }>;
  signUp(fullName: string, email: string, password: string): Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  retry(): Promise<void>;
  clearNotice(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [account, setAccount] = useState<Account | null>(null);
  const [notice, setNotice] = useState<BlockReason | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);

  /**
   * Resolve app state for a session: signed out, or load the account from the database.
   * `silent` re-checks without showing the loading screen (foreground re-validation).
   */
  const resolve = useCallback(async (session: Session | null, silent = false) => {
    sessionRef.current = session;
    if (!supabase || !session) {
      setAccount(null);
      setErrorMessage(null);
      setStatus('signedOut');
      return;
    }
    if (!silent) setStatus('loading');
    const result = await loadAccount(supabase, session.user.id);
    if (sessionRef.current?.user.id !== session.user.id) return; // superseded by a newer auth event
    if (result.kind === 'ok') {
      setAccount(result.account);
      setErrorMessage(null);
      setStatus('signedIn');
    } else if (result.kind === 'blocked') {
      // Not allowed in the app: end the session on this device and explain why.
      setNotice(result.reason);
      await endLocalSession();
      await resolve(null);
    } else {
      setErrorMessage(result.message);
      setStatus('error');
    }
  }, []);

  /**
   * Read the stored session. An expired access token is refreshed here, which needs the network:
   * if the server can't be reached, keep the stored session and show a retryable error instead of
   * signing the user out.
   */
  const restore = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.auth.getSession();
    if (error && isAuthRetryableFetchError(error)) {
      setErrorMessage(authErrorMessage(error));
      setStatus('error');
      return;
    }
    await resolve(data.session);
  }, [resolve]);

  useEffect(() => {
    if (!supabase) {
      setStatus('signedOut');
      return;
    }
    const client = supabase;
    let mounted = true;

    // Restore the persisted session (from encrypted storage), then follow auth events.
    void restore().then(() => undefined);

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'INITIAL_SESSION') return; // handled by getSession above
      if (event === 'TOKEN_REFRESHED' && session?.user.id === sessionRef.current?.user.id) {
        sessionRef.current = session;
        return;
      }
      // Defer out of the auth callback (supabase-js guidance: no awaiting auth calls inside it).
      setTimeout(() => void resolve(session), 0);
    });

    // Refresh tokens only while in the foreground; re-check the account (e.g. suspended meanwhile) on return.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void client.auth.startAutoRefresh();
        if (sessionRef.current) void resolve(sessionRef.current, true);
      } else {
        void client.auth.stopAutoRefresh();
      }
    });
    if (AppState.currentState === 'active') void client.auth.startAutoRefresh();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, [resolve, restore]);

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    if (!supabase) return { error: 'The app is not configured. See the connection check.' };
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? authErrorMessage(error) : null };
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>(async (fullName, email, password) => {
    if (!supabase) return { error: 'The app is not configured. See the connection check.', needsConfirmation: false };
    setNotice(null);
    // The database trigger creates a PASSENGER profile from full_name; roles are never chosen by users.
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (error) return { error: authErrorMessage(error), needsConfirmation: false };
    return { error: null, needsConfirmation: data.session === null };
  }, []);

  const signOut = useCallback(async () => {
    await endLocalSession();
    await resolve(null);
  }, [resolve]);

  const retry = useCallback(async () => {
    setStatus('loading');
    if (sessionRef.current) await resolve(sessionRef.current);
    else await restore();
  }, [resolve, restore]);

  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, account, notice, errorMessage, signIn, signUp, signOut, retry, clearNotice }),
    [status, account, notice, errorMessage, signIn, signUp, signOut, retry, clearNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * End the session on this device. supabase-js keeps the stored session if the sign-out request fails
 * (e.g. offline), so in that case the encrypted session is deleted directly: logout always works.
 */
async function endLocalSession(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) await secureSessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// Re-exported for screens.
export { authErrorMessage };
