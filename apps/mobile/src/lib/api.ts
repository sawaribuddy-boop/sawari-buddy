// Typed wrappers around Supabase RPCs. Each returns the parsed result or throws.
// Hooks (useXxx) consume these; screens never call RPCs directly.

import type { AppSupabaseClient } from './supabase';

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
