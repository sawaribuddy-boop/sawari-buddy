import { useQuery } from '@tanstack/react-query';

import { fetchStops } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

/** All active stops, for the route picker. Stable data, long staleTime. */
export function useStops() {
  return useQuery({
    queryKey: queryKeys.stops,
    queryFn: () => {
      if (!supabase) throw new Error('Supabase not configured');
      return fetchStops(supabase);
    },
    staleTime: 5 * 60_000, // 5 min — stops rarely change
    enabled: !!supabase,
  });
}
