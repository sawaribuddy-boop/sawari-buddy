import { describe, expect, it } from 'vitest';

import { driverBookingNotice, passengerBookingNotice, passengerRideEndedNotice, passengerTripStartedNotice } from './notices';
import type { BookingEvent } from './useTripChannel';

const event = (overrides: Partial<BookingEvent> = {}): BookingEvent => ({
  trip_id: 'trip-1',
  booking_id: 'booking-1',
  source: 'APP',
  status: 'CANCELLED',
  seat_count: 1,
  cancel_reason: 'PASSENGER_CANCELLED',
  available_seats: 3,
  ...overrides,
});

describe('passengerBookingNotice', () => {
  it('ignores other passengers’ bookings', () => {
    expect(passengerBookingNotice(event({ cancel_reason: 'TRIP_CANCELLED' }), 'booking-2')).toBeNull();
    expect(passengerBookingNotice(event({ cancel_reason: 'TRIP_CANCELLED' }), undefined)).toBeNull();
  });

  it('stays quiet when the passenger cancelled it themselves', () => {
    expect(passengerBookingNotice(event(), 'booking-1')).toBeNull();
  });

  it('explains cancellations made by someone else', () => {
    expect(passengerBookingNotice(event({ cancel_reason: 'TRIP_CANCELLED' }), 'booking-1')?.title).toBe(
      'Your ride was cancelled',
    );
    expect(passengerBookingNotice(event({ cancel_reason: 'DRIVER_UNREACHABLE' }), 'booking-1')?.message).toMatch(
      /lost contact/,
    );
    expect(passengerBookingNotice(event({ cancel_reason: 'ADMIN_CANCELLED' }), 'booking-1')?.message).toMatch(
      /support/,
    );
  });

  it('tells the passenger about a no-show', () => {
    expect(passengerBookingNotice(event({ status: 'NO_SHOW', cancel_reason: null }), 'booking-1')?.title).toBe(
      'Marked as no-show',
    );
  });

  it('stays quiet without a reason (server not migrated yet) and for non-terminal changes', () => {
    expect(passengerBookingNotice(event({ cancel_reason: undefined }), 'booking-1')).toBeNull();
    expect(passengerBookingNotice(event({ status: 'BOARDED', cancel_reason: null }), 'booking-1')).toBeNull();
  });
});

describe('driverBookingNotice', () => {
  it('names the passenger who cancelled', () => {
    expect(driverBookingNotice(event({ seat_count: 2 }), 'Priya')).toBe('Priya cancelled their booking (2 seats freed)');
  });

  it('falls back when the name is not cached', () => {
    expect(driverBookingNotice(event(), undefined)).toBe('A passenger cancelled their booking (1 seat freed)');
  });

  it('covers admin cancellations', () => {
    expect(driverBookingNotice(event({ cancel_reason: 'ADMIN_CANCELLED' }), 'Priya')).toBe(
      "SawariBuddy cancelled Priya's booking (1 seat freed)",
    );
  });

  it('ignores changes the driver made and non-cancellations', () => {
    expect(driverBookingNotice(event({ cancel_reason: 'TRIP_CANCELLED' }), 'Priya')).toBeNull();
    expect(driverBookingNotice(event({ source: 'WALK_IN', cancel_reason: 'WALK_IN_REMOVED' }), undefined)).toBeNull();
    expect(driverBookingNotice(event({ status: 'NO_SHOW', cancel_reason: null }), 'Priya')).toBeNull();
    expect(driverBookingNotice(event({ status: 'CONFIRMED', cancel_reason: null }), 'Priya')).toBeNull();
  });
});

describe('passenger trip notices', () => {
  const ride = { destination: 'Dream City', driverFirstName: 'Raj', totalFarePaise: 6000 };

  it('announces the trip starting, and nothing else', () => {
    expect(passengerTripStartedNotice({ trip_id: 'trip-1', status: 'IN_PROGRESS' }, ride)).toBe(
      'Your ride has started. Heading to Dream City.',
    );
    expect(passengerTripStartedNotice({ trip_id: 'trip-1', status: 'BOARDING' }, ride)).toBeNull();
    expect(passengerTripStartedNotice({ trip_id: 'trip-1', status: 'IN_PROGRESS' }, {})).toBe('Your ride has started.');
  });

  it('announces arrival with the cash to pay, for the passenger’s own booking only', () => {
    const done = event({ status: 'COMPLETED', cancel_reason: null });
    expect(passengerRideEndedNotice(done, 'booking-1', ride)).toBe(
      "You've reached Dream City. Please pay ₹60 in cash to Raj.",
    );
    expect(passengerRideEndedNotice(done, 'booking-2', ride)).toBeNull();
    expect(passengerRideEndedNotice(event({ status: 'BOARDED' }), 'booking-1', ride)).toBeNull();
    expect(passengerRideEndedNotice(done, 'booking-1', {})).toBe('Your ride has ended.');
  });
});
