import { useEffect, useRef } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

import { driverRatingNotice, type RatingEvent } from './notices';

/**
 * The driver's own private channel `driver:<id>` (only they may join; see 20261016000200). Today it
 * carries `rating_received`: we show a notice and refetch the average. Call once, from the driver
 * layout, for the same reason as useTripChannel.
 */
export function useDriverChannel(onNotice: (text: string) => void) {
  const { account } = useAuth();
  const driverId = account?.role === 'DRIVER' ? account.userId : null;
  const onNoticeRef = useRef(onNotice);
  onNoticeRef.current = onNotice;

  useEffect(() => {
    if (!supabase || !driverId) return;

    const channel = supabase
      .channel(`driver:${driverId}`, { config: { private: true } })
      .on('broadcast', { event: 'rating_received' }, (message) => {
        onNoticeRef.current(driverRatingNotice(message.payload as RatingEvent));
        void queryClient.invalidateQueries({ queryKey: queryKeys.driverRating });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Covers ratings that arrived while the socket was disconnected.
          void queryClient.invalidateQueries({ queryKey: queryKeys.driverRating });
        } else if (__DEV__) {
          console.log(`[driver:${driverId}] channel status: ${status}`);
        }
      });

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [driverId]);
}
