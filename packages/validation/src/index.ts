// Client-side input validation for RPC calls. UX ONLY: the database functions re-validate everything.
import { SEAT_PREFERENCE } from '@sawari/constants';
import { z } from 'zod';

const seatPreference = z.enum([SEAT_PREFERENCE.ANY, SEAT_PREFERENCE.BACK, SEAT_PREFERENCE.FRONT]);

/** maxSeats comes from get_platform_settings_public().max_seats_per_booking. */
export const bookSeatsInput = (maxSeats: number) =>
  z.object({
    p_trip_id: z.uuid(),
    p_seat_count: z.number().int().min(1).max(maxSeats),
    p_idempotency_key: z.uuid(),
    p_seat_preference: seatPreference.default('ANY'),
  });
export type BookSeatsInput = z.infer<ReturnType<typeof bookSeatsInput>>;

export const addWalkInInput = z.object({
  p_trip_id: z.uuid(),
  p_seat_count: z.number().int().min(1).max(8),
  p_idempotency_key: z.uuid(),
  p_label: z.string().trim().max(40).optional(),
});
export type AddWalkInInput = z.infer<typeof addWalkInInput>;

export const driverHeartbeatInput = z
  .object({
    p_lat: z.number().min(-90).max(90).optional(),
    p_lng: z.number().min(-180).max(180).optional(),
    p_accuracy_m: z.number().min(0).optional(),
  })
  .refine((v) => (v.p_lat === undefined) === (v.p_lng === undefined), {
    message: 'Latitude and longitude must be sent together',
  });
export type DriverHeartbeatInput = z.infer<typeof driverHeartbeatInput>;

export const openTripInput = z.object({ p_auto_id: z.uuid(), p_route_id: z.uuid() });
export type OpenTripInput = z.infer<typeof openTripInput>;

export const raiseIssueInput = z.object({
  p_kind: z.enum(['BOOKING_ISSUE', 'DRIVER_BEHAVIOUR', 'PAYMENT', 'OTHER']),
  p_description: z.string().trim().min(1).max(2000),
  p_booking_id: z.uuid().optional(),
  p_trip_id: z.uuid().optional(),
});
export type RaiseIssueInput = z.infer<typeof raiseIssueInput>;
