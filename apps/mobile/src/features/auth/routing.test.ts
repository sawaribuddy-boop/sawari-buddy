import { describe, expect, it } from 'vitest';

import { authErrorMessage } from './authErrors';
import { homeHref, routeGuards } from './routing';

describe('routeGuards', () => {
  it('shows nothing while loading or on error', () => {
    for (const status of ['loading', 'error'] as const) {
      expect(routeGuards({ status, role: 'PASSENGER' })).toEqual({ auth: false, passenger: false, driver: false });
    }
  });

  it('allows exactly one group once resolved', () => {
    expect(routeGuards({ status: 'signedOut', role: null })).toEqual({ auth: true, passenger: false, driver: false });
    expect(routeGuards({ status: 'signedIn', role: 'PASSENGER' })).toEqual({ auth: false, passenger: true, driver: false });
    expect(routeGuards({ status: 'signedIn', role: 'DRIVER' })).toEqual({ auth: false, passenger: false, driver: true });
  });

  it('never opens a mode without a role', () => {
    expect(routeGuards({ status: 'signedIn', role: null })).toEqual({ auth: false, passenger: false, driver: false });
  });
});

describe('homeHref', () => {
  it('routes by role', () => {
    expect(homeHref({ status: 'signedOut', role: null })).toBe('/welcome');
    expect(homeHref({ status: 'signedOut', role: null, hasNotice: true })).toBe('/login');
    expect(homeHref({ status: 'signedIn', role: 'PASSENGER' })).toBe('/book');
    expect(homeHref({ status: 'signedIn', role: 'DRIVER' })).toBe('/driver');
    expect(homeHref({ status: 'loading', role: null })).toBeNull();
  });
});

describe('authErrorMessage', () => {
  it('maps known codes without leaking whether an email exists', () => {
    expect(authErrorMessage({ code: 'invalid_credentials' })).toBe('Email or password is incorrect.');
    expect(authErrorMessage({ code: 'user_already_exists' })).toMatch(/already exists/);
    expect(authErrorMessage({ code: 'over_request_rate_limit' })).toMatch(/Too many attempts/);
  });

  it('recognises network failures', () => {
    expect(authErrorMessage({ name: 'AuthRetryableFetchError', message: 'Network request failed' })).toMatch(/Can't reach/);
  });

  it('falls back to a generic message', () => {
    expect(authErrorMessage({ code: 'something_new', message: 'raw server text' })).toBe('Something went wrong. Please try again.');
  });
});
