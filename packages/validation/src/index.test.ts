import { describe, expect, it } from 'vitest';

import { changePasswordInput, fieldErrors, passwordResetInput, phoneNumber, signInInput, signUpInput } from './index';

describe('signUpInput', () => {
  it('normalises email and trims the name', () => {
    expect(signUpInput.parse({ fullName: '  Priya Sharma ', email: ' Priya@Example.COM ', password: 'longenough' })).toEqual({
      fullName: 'Priya Sharma',
      email: 'priya@example.com',
      password: 'longenough',
    });
  });

  it('reports one message per invalid field', () => {
    const result = signUpInput.safeParse({ fullName: '', email: 'nope', password: 'short' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(fieldErrors(result.error)).sort()).toEqual(['email', 'fullName', 'password']);
      expect(fieldErrors(result.error).password).toMatch(/at least 8/);
    }
  });
});

describe('signInInput', () => {
  it('requires a password but not its length (server decides)', () => {
    expect(signInInput.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(signInInput.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});

describe('phoneNumber', () => {
  it.each([
    ['98765 43210', '+919876543210'],
    ['098765-43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['+44 7700 900123', '+447700900123'],
  ])('normalises %s', (raw, expected) => {
    expect(phoneNumber.parse(raw)).toBe(expected);
  });

  it('treats an empty field as no phone', () => {
    expect(phoneNumber.parse('  ')).toBeNull();
  });

  it.each(['12345', '5876543210', 'abc'])('rejects %s', (raw) => {
    expect(phoneNumber.safeParse(raw).success).toBe(false);
  });
});

describe('changePasswordInput', () => {
  it('rejects reusing the current password', () => {
    const r = changePasswordInput.safeParse({ currentPassword: 'SawariDev#2026', newPassword: 'SawariDev#2026' });
    expect(r.success).toBe(false);
  });

  it('accepts a new password of at least 8 characters', () => {
    expect(changePasswordInput.safeParse({ currentPassword: 'old', newPassword: 'NewPass#2026' }).success).toBe(true);
  });
});

describe('passwordResetInput', () => {
  it('requires a 6-digit code', () => {
    const base = { email: 'priya@sawaribuddy.local', newPassword: 'NewPass#2026' };
    expect(passwordResetInput.safeParse({ ...base, code: '12345' }).success).toBe(false);
    expect(passwordResetInput.safeParse({ ...base, code: ' 123456 ' }).success).toBe(true);
  });
});
