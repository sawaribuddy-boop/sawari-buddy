// Pure routing decisions, shared by the root navigator guards and the entry redirect.

import type { MobileRole } from './account';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'error';

export interface RouteState {
  status: AuthStatus;
  role: MobileRole | null;
  /** A sign-out reason is waiting to be shown (suspended, admin, …). */
  hasNotice?: boolean;
}

export interface Guards {
  auth: boolean;
  passenger: boolean;
  driver: boolean;
}

/** Which route group may be shown. Exactly one is true once auth has resolved; none while loading/error. */
export function routeGuards({ status, role }: RouteState): Guards {
  return {
    auth: status === 'signedOut',
    passenger: status === 'signedIn' && role === 'PASSENGER',
    driver: status === 'signedIn' && role === 'DRIVER',
  };
}

export type HomeHref = '/welcome' | '/login' | '/book' | '/driver';

/** Where the entry route sends the user, or null to stay on the loading/error screen. */
export function homeHref(state: RouteState): HomeHref | null {
  const g = routeGuards(state);
  if (g.auth) return state.hasNotice ? '/login' : '/welcome';
  if (g.passenger) return '/book';
  if (g.driver) return '/driver';
  return null;
}
