import { useQuery } from '@tanstack/react-query';

import { fetchMyDriverRating } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

/** The driver's average rating. Refetched when a `rating_received` event arrives (useDriverChannel). */
export function useDriverRating() {
  return useQuery({
    queryKey: queryKeys.driverRating,
    queryFn: () => {
      if (!supabase) throw new Error('Supabase not configured');
      return fetchMyDriverRating(supabase);
    },
    enabled: !!supabase,
  });
}
