import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  View: 'View',
}));
vi.mock('@/theme', () => ({
  colors: { white: '#fff', ink700: '#333', surface: '#f5f5f5', border: '#ddd', green700: '#1a7a3a', green50: '#e8f5e9' },
  radius: { pill: 999 },
  spacing: { xs: 4, md: 16 },
}));
vi.mock('./AppText', () => ({ AppText: 'AppText' }));

import { earningsPeriod, type EarningsPeriod, PERIOD_LABELS, startOfDayIST } from './PeriodPicker';

describe('startOfDayIST', () => {
  it('formats midnight with +05:30 offset', () => {
    expect(startOfDayIST(new Date(2026, 8, 15))).toBe('2026-09-15T00:00:00+05:30');
  });

  it('zero-pads single-digit month and day', () => {
    expect(startOfDayIST(new Date(2026, 0, 5))).toBe('2026-01-05T00:00:00+05:30');
  });

  it('handles Dec 31 (double-digit month and day)', () => {
    expect(startOfDayIST(new Date(2026, 11, 31))).toBe('2026-12-31T00:00:00+05:30');
  });
});

describe('earningsPeriod', () => {
  it('today returns empty object (RPC defaults)', () => {
    expect(earningsPeriod('today')).toEqual({});
  });

  it('yesterday returns a half-open [from, to) range with IST boundaries', () => {
    const result = earningsPeriod('yesterday');
    expect(result.from).toBeDefined();
    expect(result.to).toBeDefined();
    expect(result.from!.endsWith('+05:30')).toBe(true);
    expect(result.to!.endsWith('+05:30')).toBe(true);
    expect(result.from!.includes('T00:00:00')).toBe(true);
    expect(result.to!.includes('T00:00:00')).toBe(true);
  });

  it('this_week returns from (Monday) with no to', () => {
    const result = earningsPeriod('this_week');
    expect(result.from).toBeDefined();
    expect(result.to).toBeUndefined();
    expect(result.from!.endsWith('+05:30')).toBe(true);
  });

  it('all_time returns epoch with IST offset', () => {
    expect(earningsPeriod('all_time')).toEqual({ from: '1970-01-01T00:00:00+05:30' });
  });
});

describe('PERIOD_LABELS', () => {
  it('has an entry for every EarningsPeriod key', () => {
    const keys: EarningsPeriod[] = ['today', 'yesterday', 'this_week', 'all_time'];
    for (const key of keys) {
      expect(PERIOD_LABELS[key]).toBeDefined();
      expect(typeof PERIOD_LABELS[key]).toBe('string');
    }
  });
});
