import { describe, expect, it } from 'vitest';

import { fieldErrors, signInInput, signUpInput } from './index';

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
