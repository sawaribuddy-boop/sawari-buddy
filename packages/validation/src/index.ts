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

// ---------------------------------------------------------------------------
// Auth forms (email + password for development; phone OTP is a pre-launch task)
// ---------------------------------------------------------------------------

/** Mirrors supabase/config.toml [auth] minimum_password_length. */
export const MIN_PASSWORD_LENGTH = 8;

const email = z.string().trim().toLowerCase().pipe(z.email({ message: 'Enter a valid email address' }));

export const signInInput = z.object({
  email,
  password: z.string().min(1, { message: 'Enter your password' }),
});
export type SignInInput = z.infer<typeof signInInput>;

const fullName = z
  .string()
  .trim()
  .min(1, { message: 'Enter your name' })
  .max(80, { message: 'Name must be 80 characters or fewer' });

const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, { message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` })
  .max(72, { message: 'Password must be 72 characters or fewer' });

/**
 * Phone as people type it in India ("98765 43210", "098765 43210", "+91 98765 43210"), stored in the
 * international format profiles.phone requires (+919876543210). Empty means no phone.
 */
export const phoneNumber = z
  .string()
  .transform((raw) => {
    const compact = raw.replace(/[\s()-]/g, '');
    if (compact === '') return null;
    if (/^[6-9]\d{9}$/.test(compact)) return `+91${compact}`;
    if (/^0[6-9]\d{9}$/.test(compact)) return `+91${compact.slice(1)}`;
    if (/^91[6-9]\d{9}$/.test(compact)) return `+${compact}`;
    return compact;
  })
  .refine((v) => v === null || /^\+[1-9]\d{7,14}$/.test(v), { message: 'Enter a valid mobile number' });

export const signUpInput = z.object({ fullName, email, password: newPassword });
export type SignUpInput = z.infer<typeof signUpInput>;

export const editProfileInput = z.object({ fullName, phone: phoneNumber });
export type EditProfileInput = z.infer<typeof editProfileInput>;

export const changePasswordInput = z
  .object({
    currentPassword: z.string().min(1, { message: 'Enter your current password' }),
    newPassword,
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'Choose a password different from your current one',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordInput>;

export const passwordResetRequestInput = z.object({ email });

export const passwordResetInput = z.object({
  email,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { message: 'Enter the 6-digit code from the email' }),
  newPassword,
});
export type PasswordResetInput = z.infer<typeof passwordResetInput>;

/** First error message per field, for showing under inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}
