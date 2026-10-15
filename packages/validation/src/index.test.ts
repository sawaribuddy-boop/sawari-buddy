import { describe, expect, it } from 'vitest';

import {
  changePasswordInput,
  fieldErrors,
  mobileNumber,
  otpCode,
  passwordResetInput,
  phoneNumber,
  signInInput,
  signUpInput,
} from './index';

describe('signUpInput', () => {
  it('normalises email and trims the name', () => {
    expect(
      signUpInput.parse({ fullName: '  Priya Sharma ', email: ' Priya@Example.COM ', phone: '98765 43210', password: 'longenough' }),
    ).toEqual({
      fullName: 'Priya Sharma',
      email: 'priya@example.com',
      phone: '+919876543210',
      password: 'longenough',
    });
  });

  it('reports one message per invalid field', () => {
    const result = signUpInput.safeParse({ fullName: '', email: 'nope', phone: '', password: 'short' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(fieldErrors(result.error)).sort()).toEqual(['email', 'fullName', 'password', 'phone']);
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

describe('mobileNumber', () => {
  it('normalises like phoneNumber but requires a number', () => {
    expect(mobileNumber.parse('98765 43210')).toBe('+919876543210');
    expect(mobileNumber.safeParse('  ').error?.issues[0]?.message).toBe('Enter your mobile number');
  });
});

describe('otpCode', () => {
  it('accepts 6 digits, ignoring spaces', () => {
    expect(otpCode.parse(' 123 456 ')).toBe('123456');
  });

  it.each(['', '12345', '1234567', 'abcdef'])('rejects %s', (raw) => {
    expect(otpCode.safeParse(raw).success).toBe(false);
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
  it('accepts the 6- or 8-digit code from the email', () => {
    const base = { email: 'priya@sawaribuddy.local', newPassword: 'NewPass#2026' };
    expect(passwordResetInput.safeParse({ ...base, code: '12345' }).success).toBe(false);
    expect(passwordResetInput.safeParse({ ...base, code: ' 123456 ' }).success).toBe(true);
    expect(passwordResetInput.safeParse({ ...base, code: '12345678' }).success).toBe(true);
    expect(passwordResetInput.safeParse({ ...base, code: '12a456' }).success).toBe(false);
  });
});
