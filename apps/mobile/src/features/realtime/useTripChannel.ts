import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

/**
 * Subscribe to the `trip:<tripId>` broadcast channel. On any event, invalidate the relevant
 * TanStack queries so they refetch authoritative data from the server. The realtime payload
 * is treated as a *signal*, never as the source of truth.
 *
 * The channel is private: the database sends with `realtime.send(..., private => true)` and
 * RLS on realtime.messages decides who may join, so the client must join with `private: true`
 * or it never receives anything.
 *
 * Automatically unsubscribes on unmount or when tripId changes.
 */
export function useTripChannel(tripId: string | null | undefined) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!supabase || !tripId) return;

    const channel = supabase.channel(`trip:${tripId}`, {
      config: { private: true },
    });

    channel
      .on('broadcast', { event: 'trip_changed' }, () => {
        // Trip status changed — refetch everything that depends on trip state.
        void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
        void queryClient.invalidateQueries({ queryKey: queryKeys.tripManifest(tripId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.myActiveBooking });
      })
      .on('broadcast', { event: 'booking_changed' }, () => {
        // Booking added/changed on this trip — refetch manifest and active booking.
        void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
        void queryClient.invalidateQueries({ queryKey: queryKeys.tripManifest(tripId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.myActiveBooking });
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
          void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
          void queryClient.invalidateQueries({ queryKey: queryKeys.tripManifest(tripId) });
          void queryClient.invalidateQueries({ queryKey: queryKeys.myActiveBooking });
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
