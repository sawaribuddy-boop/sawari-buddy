import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export interface BookingEvent {
  passenger_name: string;
  seat_count: number;
  action: 'booked' | 'cancelled';
}

interface TripChannelOptions {
  onBookingChanged?: (event: BookingEvent) => void;
}

/**
 * Subscribe to the `trip:<tripId>` broadcast channel. On any event, invalidate the relevant
 * TanStack queries so they refetch authoritative data from the server. The realtime payload
 * is treated as a *signal*, never as the source of truth.
 *
 * Automatically unsubscribes on unmount or when tripId changes.
 */
export function useTripChannel(tripId: string | null | undefined, options?: TripChannelOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(options?.onBookingChanged);
  callbackRef.current = options?.onBookingChanged;

  useEffect(() => {
    if (!supabase || !tripId) return;

    const channel = supabase.channel(`trip:${tripId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on('broadcast', { event: 'trip_changed' }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
        void queryClient.invalidateQueries({ queryKey: queryKeys.tripManifest(tripId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.myActiveBooking });
      })
      .on('broadcast', { event: 'booking_changed' }, (msg) => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
        void queryClient.invalidateQueries({ queryKey: queryKeys.tripManifest(tripId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.myActiveBooking });
        void queryClient.invalidateQueries({ queryKey: ['search-trips'] });

        const payload = msg.payload as BookingEvent | undefined;
        if (payload && callbackRef.current) {
          callbackRef.current(payload);
        }
      })
      .on('broadcast', { event: 'presence_update' }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.myActiveBooking });
      })
      .subscribe((status) => {
        if (__DEV__ && status !== 'SUBSCRIBED') {
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
