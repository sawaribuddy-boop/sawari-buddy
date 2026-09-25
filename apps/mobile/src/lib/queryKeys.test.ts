import { describe, expect, it } from 'vitest';

import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  it('returns stable references for static keys', () => {
    expect(queryKeys.myActiveBooking).toBe(queryKeys.myActiveBooking);
    expect(queryKeys.driverHome).toBe(queryKeys.driverHome);
    expect(queryKeys.platformSettings).toBe(queryKeys.platformSettings);
  });

  it('returns consistent keys for parameterised queries', () => {
    expect(queryKeys.myBooking('abc')).toEqual(['my-booking', 'abc']);
    expect(queryKeys.tripManifest('xyz')).toEqual(['trip-manifest', 'xyz']);
    expect(queryKeys.searchTrips('a', 'b')).toEqual(['search-trips', { origin: 'a', destination: 'b' }]);
    expect(queryKeys.driverEarnings('f', 't')).toEqual(['driver-earnings', { from: 'f', to: 't' }]);
  });

  it('myBookingHistory cursor defaults to undefined', () => {
    expect(queryKeys.myBookingHistory()).toEqual(['my-booking-history', { before: undefined }]);
    expect(queryKeys.myBookingHistory('2026-01-01')).toEqual(['my-booking-history', { before: '2026-01-01' }]);
  });
});
