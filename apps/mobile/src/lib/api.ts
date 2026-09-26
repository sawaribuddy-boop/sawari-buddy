// Typed wrappers around Supabase RPCs. Each returns the parsed result or throws.
// Hooks (useXxx) consume these; screens never call RPCs directly.

import type { Database } from '@sawari/types';

import type { AppSupabaseClient } from './supabase';

type TripCancelReason = Database['public']['Enums']['trip_cancel_reason'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Unwrap a Supabase RPC response, throwing on error so TanStack Query treats it as failed. */
function unwrap<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw res.error;
  return res.data;
}

// ---------------------------------------------------------------------------
// Passenger reads
// ---------------------------------------------------------------------------

export async function fetchMyActiveBooking(client: AppSupabaseClient) {
  return unwrap(await client.rpc('get_my_active_booking'));
}

export async function fetchMyBookingHistory(
  client: AppSupabaseClient,
  opts: { limit?: number; before?: string } = {},
) {
  return unwrap(
    await client.rpc('get_my_booking_history', {
      p_limit: opts.limit ?? 20,
      p_before: opts.before,
    }),
  );
}

export async function fetchMyBooking(client: AppSupabaseClient, bookingId: string) {
  return unwrap(await client.rpc('get_my_booking', { p_booking_id: bookingId }));
}

export async function fetchSearchTrips(
  client: AppSupabaseClient,
  originStopId: string,
  destinationStopId: string,
) {
  return unwrap(
    await client.rpc('search_trips', {
      p_origin_stop_id: originStopId,
      p_destination_stop_id: destinationStopId,
    }),
  );
}

// ---------------------------------------------------------------------------
// Driver reads
// ---------------------------------------------------------------------------

export async function fetchDriverHome(client: AppSupabaseClient) {
  return unwrap(await client.rpc('get_driver_home'));
}

export async function fetchTripManifest(client: AppSupabaseClient, tripId: string) {
  return unwrap(await client.rpc('get_trip_manifest', { p_trip_id: tripId }));
}

export async function fetchDriverEarnings(
  client: AppSupabaseClient,
  opts: { from?: string; to?: string } = {},
) {
  return unwrap(
    await client.rpc('driver_earnings_summary', {
      p_from: opts.from,
      p_to: opts.to,
      p_driver_id: undefined,
    }),
  );
}

// ---------------------------------------------------------------------------
// Passenger mutations
// ---------------------------------------------------------------------------

export async function bookSeats(
  client: AppSupabaseClient,
  args: {
    tripId: string;
    seatCount: number;
    idempotencyKey: string;
    seatPreference: 'ANY' | 'BACK' | 'FRONT';
  },
) {
  return unwrap(
    await client.rpc('book_seats', {
      p_trip_id: args.tripId,
      p_seat_count: args.seatCount,
      p_idempotency_key: args.idempotencyKey,
      p_seat_preference: args.seatPreference,
    }),
  );
}

export async function cancelBooking(client: AppSupabaseClient, bookingId: string) {
  return unwrap(await client.rpc('cancel_booking', { p_booking_id: bookingId }));
}

// ---------------------------------------------------------------------------
// Driver mutations
// ---------------------------------------------------------------------------

export async function openTrip(client: AppSupabaseClient, autoId: string, routeId: string) {
  return unwrap(await client.rpc('open_trip', { p_auto_id: autoId, p_route_id: routeId }));
}

export async function finalCall(client: AppSupabaseClient, tripId: string) {
  return unwrap(await client.rpc('final_call', { p_trip_id: tripId }));
}

export async function startTrip(client: AppSupabaseClient, tripId: string) {
  return unwrap(await client.rpc('start_trip', { p_trip_id: tripId }));
}

export async function completeTrip(client: AppSupabaseClient, tripId: string) {
  return unwrap(await client.rpc('complete_trip', { p_trip_id: tripId }));
}

export async function cancelTrip(client: AppSupabaseClient, tripId: string, reason?: TripCancelReason) {
  return unwrap(await client.rpc('cancel_trip', { p_trip_id: tripId, p_reason: reason }));
}

export async function resumeTrip(client: AppSupabaseClient, tripId: string) {
  return unwrap(await client.rpc('resume_trip', { p_trip_id: tripId }));
}

export async function goOffline(client: AppSupabaseClient) {
  return unwrap(await client.rpc('go_offline'));
}

export async function driverHeartbeat(
  client: AppSupabaseClient,
  args: { lat?: number; lng?: number; accuracyM?: number } = {},
) {
  return unwrap(
    await client.rpc('driver_heartbeat', {
      p_lat: args.lat,
      p_lng: args.lng,
      p_accuracy_m: args.accuracyM,
    }),
  );
}

export async function addWalkIn(
  client: AppSupabaseClient,
  args: { tripId: string; seatCount: number; idempotencyKey: string; label?: string },
) {
  return unwrap(
    await client.rpc('add_walk_in', {
      p_trip_id: args.tripId,
      p_seat_count: args.seatCount,
      p_idempotency_key: args.idempotencyKey,
      p_label: args.label,
    }),
  );
}

export async function removeWalkIn(client: AppSupabaseClient, bookingId: string) {
  return unwrap(await client.rpc('remove_walk_in', { p_booking_id: bookingId }));
}

export async function markBoarded(client: AppSupabaseClient, bookingId: string) {
  return unwrap(await client.rpc('mark_boarded', { p_booking_id: bookingId }));
}

export async function markNoShow(client: AppSupabaseClient, bookingId: string) {
  return unwrap(await client.rpc('mark_no_show', { p_booking_id: bookingId }));
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export async function fetchPlatformSettings(client: AppSupabaseClient) {
  return unwrap(await client.rpc('get_platform_settings_public'));
}

export async function fetchStops(client: AppSupabaseClient) {
  return unwrap(await client.from('stops').select('id, name, lat, lng').eq('is_active', true).order('name'));
}

export async function fetchRoutes(client: AppSupabaseClient) {
  return unwrap(
    await client
      .from('routes')
      .select('id, origin_stop_id, destination_stop_id, fare_paise, approx_distance_m, display_order')
      .eq('is_active', true)
      .order('display_order'),
  );
}
