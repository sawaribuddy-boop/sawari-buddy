import { describe, expect, it } from 'vitest';

import { authErrorMessage } from './authErrors';

describe('authErrorMessage', () => {
  it('returns generic message for null', () => {
    expect(authErrorMessage(null)).toBe('Something went wrong. Please try again.');
  });

  it('returns generic message for undefined', () => {
    expect(authErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
  });

  it('maps invalid_credentials without revealing email existence', () => {
    expect(authErrorMessage({ code: 'invalid_credentials' })).toBe('Email or password is incorrect.');
  });

  it('maps user_already_exists', () => {
    expect(authErrorMessage({ code: 'user_already_exists' })).toMatch(/already exists/);
  });

  it('maps email_exists to the same message as user_already_exists', () => {
    expect(authErrorMessage({ code: 'email_exists' })).toBe(authErrorMessage({ code: 'user_already_exists' }));
  });

  it('maps weak_password', () => {
    expect(authErrorMessage({ code: 'weak_password' })).toMatch(/stronger password/);
  });

  it('maps email_address_invalid', () => {
    expect(authErrorMessage({ code: 'email_address_invalid' })).toMatch(/valid email/);
  });

  it('maps over_request_rate_limit', () => {
    expect(authErrorMessage({ code: 'over_request_rate_limit' })).toMatch(/Too many attempts/);
  });

  it('maps over_email_send_rate_limit to the same message', () => {
    expect(authErrorMessage({ code: 'over_email_send_rate_limit' })).toBe(
      authErrorMessage({ code: 'over_request_rate_limit' }),
    );
  });

  it('maps signup_disabled', () => {
    expect(authErrorMessage({ code: 'signup_disabled' })).toMatch(/disabled/);
  });

  it('maps email_not_confirmed', () => {
    expect(authErrorMessage({ code: 'email_not_confirmed' })).toMatch(/confirm your email/);
  });

  it('detects AuthRetryableFetchError by name', () => {
    expect(authErrorMessage({ name: 'AuthRetryableFetchError' })).toMatch(/Check your connection/);
  });

  it('detects network failure by message pattern', () => {
    expect(authErrorMessage({ message: 'Network request failed' })).toMatch(/Check your connection/);
    expect(authErrorMessage({ message: 'Failed to fetch' })).toMatch(/Check your connection/);
    expect(authErrorMessage({ message: 'fetch failed' })).toMatch(/Check your connection/);
  });

  it('returns generic message for unknown error codes', () => {
    expect(authErrorMessage({ code: 'some_unknown_code' })).toBe('Something went wrong. Please try again.');
  });
});
