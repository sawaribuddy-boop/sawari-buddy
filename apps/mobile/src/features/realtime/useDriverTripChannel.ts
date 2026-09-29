import { useDriverHome } from '@/features/driver/useDriverHome';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

import { driverBookingNotice } from './notices';
import { useTripChannel } from './useTripChannel';

type CachedBooking = { id: string; passenger_first_name?: string | null };

/** The passenger's first name from data already on screen (manifest or home card). */
function cachedPassengerName(tripId: string, bookingId: string): string | undefined {
  const manifest = queryClient.getQueryData<{ bookings?: CachedBooking[] }>(queryKeys.tripManifest(tripId));
  const home = queryClient.getQueryData<{ active_trip?: { bookings?: CachedBooking[] } | null }>(queryKeys.driverHome);
  const bookings = [...(manifest?.bookings ?? []), ...(home?.active_trip?.bookings ?? [])];
  return bookings.find((b) => b.id === bookingId)?.passenger_first_name ?? undefined;
}

/**
 * The driver's single subscription: their active trip's channel, on every driver screen.
 * Calls `onNotice` when a passenger (or an admin) cancels an app booking on the trip.
 */
export function useDriverTripChannel(onNotice: (text: string) => void) {
  const { data } = useDriverHome();
  const tripId = (data as { active_trip?: { trip: { id: string } } | null } | null)?.active_trip?.trip.id;

  useTripChannel(tripId, {
    onBookingChanged: (event) => {
      const text = driverBookingNotice(event, cachedPassengerName(event.trip_id, event.booking_id));
      if (text) onNotice(text);
    },
  });
}
