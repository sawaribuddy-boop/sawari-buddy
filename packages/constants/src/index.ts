// Mirrors of database enums and error codes. The database is the source of truth:
// these exist so UI code can switch on values and show messages without magic strings.

export const USER_ROLE = { PASSENGER: 'PASSENGER', DRIVER: 'DRIVER', ADMIN: 'ADMIN' } as const;
export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export const TRIP_STATUS = {
  OPEN: 'OPEN',
  BOARDING: 'BOARDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  SUSPENDED: 'SUSPENDED',
} as const;
export type TripStatus = (typeof TRIP_STATUS)[keyof typeof TRIP_STATUS];

export const ACTIVE_TRIP_STATUSES: readonly TripStatus[] = ['OPEN', 'BOARDING', 'IN_PROGRESS', 'SUSPENDED'];

export const BOOKING_STATUS = {
  CONFIRMED: 'CONFIRMED',
  BOARDED: 'BOARDED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

/** Statuses that hold seats on a trip (mirrors private.booking_occupies_seat). */
export const SEAT_OCCUPYING_STATUSES: readonly BookingStatus[] = ['CONFIRMED', 'BOARDED'];

export const BOOKING_SOURCE = { APP: 'APP', WALK_IN: 'WALK_IN' } as const;
export type BookingSource = (typeof BOOKING_SOURCE)[keyof typeof BOOKING_SOURCE];

export const SEAT_PREFERENCE = { ANY: 'ANY', BACK: 'BACK', FRONT: 'FRONT' } as const;
export type SeatPreference = (typeof SEAT_PREFERENCE)[keyof typeof SEAT_PREFERENCE];

export const DRIVER_AVAILABILITY = { ONLINE: 'ONLINE', UNREACHABLE: 'UNREACHABLE', OFFLINE: 'OFFLINE' } as const;
export type DriverAvailability = (typeof DRIVER_AVAILABILITY)[keyof typeof DRIVER_AVAILABILITY];

/** Stable codes raised by database functions (error.message). */
export const ERROR_MESSAGES = {
  NO_SEAT_AVAILABLE: 'No seat available on this auto.',
  TRIP_NOT_BOOKABLE: 'This auto is no longer taking bookings.',
  TRIP_NOT_FOUND: 'Trip not found.',
  BOOKING_NOT_FOUND: 'Booking not found.',
  DRIVER_UNREACHABLE: 'The driver is currently unreachable. Please choose another auto.',
  ALREADY_HAS_ACTIVE_BOOKING: 'You already have an active booking.',
  SEAT_COUNT_INVALID: 'Please choose a valid number of seats.',
  IDEMPOTENCY_KEY_REQUIRED: 'Something went wrong. Please try again.',
  IDEMPOTENCY_KEY_REUSED: 'Something went wrong. Please try again.',
  GRACE_PERIOD_NOT_ELAPSED: 'Please wait for the boarding grace period to end.',
  FINAL_CALL_REQUIRED: 'Make the final call before marking a no-show.',
  PASSENGERS_PENDING: 'Some booked passengers have not boarded yet.',
  NO_PASSENGERS_BOARDED: 'No passengers on board yet.',
  TRIP_NOT_ACCEPTING_WALK_INS: 'Walk-ins can only be added before departure.',
  NOT_A_WALK_IN: 'Only walk-in passengers can be removed.',
  ACTIVE_TRIP_EXISTS: 'Finish or cancel your current trip first.',
  AUTO_NOT_AVAILABLE: 'This auto is not active.',
  AUTO_NOT_ASSIGNED: 'This auto is not assigned to you.',
  AUTO_IN_USE: 'This auto is already on another trip.',
  ROUTE_NOT_AVAILABLE: 'This route is not active.',
  DRIVER_NOT_ACTIVE: 'Your driver account is not active.',
  DRIVER_NOT_ONLINE: 'Go online to share your location.',
  INVALID_LOCATION: 'Location could not be read.',
  INVALID_TRANSITION: 'That action is not possible right now.',
  INVALID_REASON: 'Invalid reason.',
  INVALID_ISSUE_KIND: 'Invalid issue type.',
  IMMUTABLE_FIELD: 'That field cannot be changed.',
  NOT_AUTHORISED: 'You are not allowed to do that.',
  CANNOT_CHANGE_OWN_ROLE: 'You cannot change your own role.',
  USER_NOT_FOUND: 'User not found.',
  DRIVER_ID_REQUIRED: 'Driver is required.',
  LEDGER_IMMUTABLE: 'Ledger records cannot be changed.',
  LEDGER_UNBALANCED: 'Ledger transaction is unbalanced.',
} as const;
export type ErrorCode = keyof typeof ERROR_MESSAGES;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_MESSAGES, value);
}

/** Human message for an error thrown by a Supabase RPC call. */
export function errorMessageFor(error: { message?: string } | null | undefined): string {
  const code = error?.message;
  return isErrorCode(code) ? ERROR_MESSAGES[code] : 'Something went wrong. Please try again.';
}
