import { BOOKING_SOURCE, BOOKING_STATUS } from '@sawari/constants';

import type { BookingEvent } from './useTripChannel';

export interface Notice {
  title: string;
  message: string;
}

/**
 * What to tell a passenger when their own booking is ended by someone else. Returns null for
 * other passengers' bookings and for cancellations the passenger made themselves.
 */
export function passengerBookingNotice(event: BookingEvent, myBookingId: string | undefined): Notice | null {
  if (!myBookingId || event.booking_id !== myBookingId) return null;

  if (event.status === BOOKING_STATUS.NO_SHOW) {
    return {
      title: 'Marked as no-show',
      message: 'The driver marked you as a no-show because you did not board in time.',
    };
  }
  if (event.status !== BOOKING_STATUS.CANCELLED) return null;

  switch (event.cancel_reason) {
    case 'TRIP_CANCELLED':
      return {
        title: 'Your ride was cancelled',
        message: 'This trip was cancelled before departure. Please book another auto.',
      };
    case 'DRIVER_UNREACHABLE':
      return {
        title: 'Your ride was cancelled',
        message: 'We lost contact with the driver, so this trip was cancelled. Please book another auto.',
      };
    case 'ADMIN_CANCELLED':
      return { title: 'Your booking was cancelled', message: 'SawariBuddy support cancelled this booking.' };
    default:
      // PASSENGER_CANCELLED (they did it) or an older server that does not send the reason.
      return null;
  }
}

/**
 * Toast text for the driver when an app booking on their trip is cancelled by the passenger or
 * by an admin. Driver-initiated changes (cancel trip, no-show, remove walk-in) return null.
 * `passengerName` comes from the cached manifest, read before it is refetched.
 */
export function driverBookingNotice(event: BookingEvent, passengerName: string | undefined): string | null {
  if (event.source !== BOOKING_SOURCE.APP || event.status !== BOOKING_STATUS.CANCELLED) return null;

  const name = passengerName || 'A passenger';
  const seats = `${event.seat_count} ${event.seat_count === 1 ? 'seat' : 'seats'}`;
  switch (event.cancel_reason) {
    case 'PASSENGER_CANCELLED':
      return `${name} cancelled their booking (${seats} freed)`;
    case 'ADMIN_CANCELLED':
      return `SawariBuddy cancelled ${passengerName ? `${passengerName}'s` : 'a'} booking (${seats} freed)`;
    default:
      return null;
  }
}
