import type { BookingSource, BookingStatus } from '@sawari/constants';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

/** Payload of the `booking_changed` broadcast (see private.bookings_broadcast). */
export interface BookingEvent {
  trip_id: string;
  booking_id: string;
  source: BookingSource;
  status: BookingStatus;
  seat_count: number;
  /** Null unless CANCELLED. Missing on servers without the 20260930000100 migration. */
  cancel_reason?: string | null;
  available_seats: number;
}

interface TripChannelOptions {
  /** Called before queries are invalidated, so cached data still shows the previous state. */
  onBookingChanged?: (event: BookingEvent) => void;
}

function invalidateTripQueries(tripId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
  void queryClient.invalidateQueries({ queryKey: queryKeys.tripManifest(tripId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.myActiveBooking });
  void queryClient.invalidateQueries({ queryKey: ['my-booking'] });
  void queryClient.invalidateQueries({ queryKey: ['my-booking-history'] });
  // A completed trip leaves the passenger a ride to rate.
  void queryClient.invalidateQueries({ queryKey: queryKeys.myPendingRating });
}

/**
 * Subscribe to the `trip:<tripId>` broadcast channel. On any event, invalidate the relevant
 * TanStack queries so they refetch authoritative data from the server. The realtime payload
 * is treated as a *signal*, never as the source of truth.
 *
 * The channel is private: the database sends with `realtime.send(..., private => true)` and
 * RLS on realtime.messages decides who may join, so the client must join with `private: true`
 * or it never receives anything.
 *
 * Call this from one place per role (the route-group layout). supabase-js returns the same
 * channel object for a topic that is already open, so a second subscriber on another screen
 * would tear down the first one's channel when it unmounts.
 *
 * Automatically unsubscribes on unmount or when tripId changes.
 */
export function useTripChannel(tripId: string | null | undefined, options?: TripChannelOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onBookingChangedRef = useRef(options?.onBookingChanged);
  onBookingChangedRef.current = options?.onBookingChanged;

  useEffect(() => {
    if (!supabase || !tripId) return;

    const channel = supabase.channel(`trip:${tripId}`, {
      config: { private: true },
    });

    channel
      .on('broadcast', { event: 'trip_changed' }, () => {
        // Trip status changed — refetch everything that depends on trip state.
        invalidateTripQueries(tripId);
      })
      .on('broadcast', { event: 'booking_changed' }, (message) => {
        onBookingChangedRef.current?.(message.payload as BookingEvent);
        // Booking added/changed on this trip — refetch manifest and bookings.
        invalidateTripQueries(tripId);
        // Also invalidate search results since available_seats changed.
        void queryClient.invalidateQueries({ queryKey: ['search-trips'] });
      })
      .on('broadcast', { event: 'location' }, () => {
        // Driver location update broadcast to passengers.
        void queryClient.invalidateQueries({ queryKey: queryKeys.myActiveBooking });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Covers events missed before the first join or while the socket was reconnecting.
          invalidateTripQueries(tripId);
        } else if (__DEV__) {
          console.log(`[trip:${tripId}] channel status: ${status}`);
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      void supabase?.removeChannel(channel);
    };
  }, [tripId]);
}
