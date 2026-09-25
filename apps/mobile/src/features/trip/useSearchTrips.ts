import { useQuery } from '@tanstack/react-query';

import { fetchSearchTrips } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

/**
 * Bookable trips for a given origin → destination pair. Returns OPEN trips
 * with a reachable driver and available seats.
 */
export function useSearchTrips(originStopId: string | null, destinationStopId: string | null) {
  return useQuery({
    queryKey: queryKeys.searchTrips(originStopId ?? '', destinationStopId ?? ''),
    queryFn: () => {
      if (!supabase || !originStopId || !destinationStopId) throw new Error('Missing params');
      return fetchSearchTrips(supabase, originStopId, destinationStopId);
    },
    enabled: !!supabase && !!originStopId && !!destinationStopId,
  });
}
