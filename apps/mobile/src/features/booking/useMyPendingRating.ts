import { useQuery } from '@tanstack/react-query';

import { fetchMyPendingRating } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export interface PendingRating {
  booking_id: string;
  code: string;
  completed_at: string;
  origin: string;
  destination: string;
  driver_first_name: string;
  auto_registration: string;
}

/**
 * The passenger's latest completed, unrated ride from the last 24 hours, or null.
 * Refetched when the trip channel reports the ride completed, and on app start.
 */
export function useMyPendingRating() {
  return useQuery({
    queryKey: queryKeys.myPendingRating,
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase not configured');
      return (await fetchMyPendingRating(supabase)) as PendingRating | null;
    },
    enabled: !!supabase,
  });
}
