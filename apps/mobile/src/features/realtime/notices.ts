import { BOOKING_SOURCE, BOOKING_STATUS, PAYMENT_STATUS, TRIP_STATUS } from '@sawari/constants';
import { formatRupees } from '@sawari/domain';

import type { BookingEvent, TripEvent } from './useTripChannel';

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

/** What the passenger's app already knows about the ride (cached active booking). */
export interface RideContext {
  destination?: string;
  driverFirstName?: string;
  totalFarePaise?: number;
  boardingPin?: string;
}

/** Toast when the driver starts the passenger's trip, or makes the final call before it. */
export function passengerTripStartedNotice(event: TripEvent, ride: RideContext): string | null {
  if (event.status === TRIP_STATUS.BOARDING) {
    const who = ride.driverFirstName ?? 'The driver';
    return ride.boardingPin
      ? `${who} made the final call. Your boarding PIN is ${ride.boardingPin}.`
      : `${who} made the final call. Please board now.`;
  }
  if (event.status !== TRIP_STATUS.IN_PROGRESS) return null;
  return ride.destination ? `Your ride has started. Heading to ${ride.destination}.` : 'Your ride has started.';
}

/** Toast when the driver drops the passenger off (or the trip is ended with them on board). */
export function passengerRideEndedNotice(event: BookingEvent, myBookingId: string | undefined, ride: RideContext): string | null {
  if (!myBookingId || event.booking_id !== myBookingId || event.status !== BOOKING_STATUS.COMPLETED) return null;
  const arrived = ride.destination ? `You've reached ${ride.destination}.` : 'Your ride has ended.';
  if (event.payment_status === PAYMENT_STATUS.PAID) return `${arrived} Payment received. Thanks for riding!`;
  if (!ride.totalFarePaise) return arrived;
  if (event.payment_status === PAYMENT_STATUS.UNPAID) {
    return `${arrived} Your fare of ${formatRupees(ride.totalFarePaise)} is marked as not paid.`;
  }
  const to = ride.driverFirstName ? ` to ${ride.driverFirstName}` : '';
  return `${arrived} Please pay ${formatRupees(ride.totalFarePaise)} in cash${to}.`;
}

/** Toast when the driver boards the passenger with their PIN. */
export function passengerBoardedNotice(event: BookingEvent, myBookingId: string | undefined): string | null {
  if (!myBookingId || event.booking_id !== myBookingId || event.status !== BOOKING_STATUS.BOARDED) return null;
  return "You're on board. Enjoy your ride!";
}

/** Toast right after booking: the PIN to give the driver. */
export function bookingConfirmedNotice(pin: string): string {
  return `Booking confirmed. Your boarding PIN is ${pin}. Tell it to the driver when you get in.`;
}
