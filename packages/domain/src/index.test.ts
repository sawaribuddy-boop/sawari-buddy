import { describe, expect, it } from 'vitest';
import { driverAvailability, formatApproxDistance, formatRupees, haversineMeters, secondsUntil, splitFare } from './index';

describe('haversineMeters', () => {
  it('is zero for the same point', () => {
    expect(haversineMeters({ lat: 28.6, lng: 77.4 }, { lat: 28.6, lng: 77.4 })).toBe(0);
  });

  it('matches a known distance (1 degree of latitude ≈ 111.2 km)', () => {
    expect(haversineMeters({ lat: 28, lng: 77 }, { lat: 29, lng: 77 })).toBeCloseTo(111_195, -2);
  });

  it('is symmetric', () => {
    const a = { lat: 28.5708, lng: 77.3261 };
    const b = { lat: 28.6139, lng: 77.438 };
    expect(haversineMeters(a, b)).toBe(haversineMeters(b, a));
  });
});

describe('formatApproxDistance', () => {
  it('uses metres below 1 km and km above', () => {
    expect(formatApproxDistance(447)).toBe('≈ 450 m away');
    expect(formatApproxDistance(1234)).toBe('≈ 1.2 km away');
    expect(formatApproxDistance(3)).toBe('≈ 10 m away');
  });
});

describe('splitFare', () => {
  it('matches the ₹40 / 10% example from the spec', () => {
    expect(splitFare(4000, 1000)).toEqual({ platformFeePaise: 400, driverEarningPaise: 3600 });
  });

  it('rounds half up like the database', () => {
    expect(splitFare(3333, 1000).platformFeePaise).toBe(333);
    expect(splitFare(3335, 1000).platformFeePaise).toBe(334);
  });

  it('rejects invalid input', () => {
    expect(() => splitFare(-1, 1000)).toThrow(RangeError);
    expect(() => splitFare(100, 10_001)).toThrow(RangeError);
  });
});

describe('formatRupees', () => {
  it('formats paise', () => {
    expect(formatRupees(3000)).toBe('₹30');
    expect(formatRupees(2550)).toBe('₹25.50');
  });
});

describe('driverAvailability', () => {
  const now = new Date('2026-09-26T10:00:00Z');

  it('derives ONLINE / UNREACHABLE / OFFLINE from last_seen_at', () => {
    expect(driverAvailability(false, now, 60, now)).toBe('OFFLINE');
    expect(driverAvailability(true, new Date('2026-09-26T09:59:30Z'), 60, now)).toBe('ONLINE');
    expect(driverAvailability(true, new Date('2026-09-26T09:58:30Z'), 60, now)).toBe('UNREACHABLE');
    expect(driverAvailability(true, null, 60, now)).toBe('UNREACHABLE');
  });
});

describe('secondsUntil', () => {
  it('counts down and floors at zero', () => {
    const now = new Date('2026-09-26T10:00:00Z');
    expect(secondsUntil('2026-09-26T10:05:00Z', now)).toBe(300);
    expect(secondsUntil('2026-09-26T09:00:00Z', now)).toBe(0);
  });
});
