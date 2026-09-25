import { useQuery } from '@tanstack/react-query';

import { fetchTripManifest } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

/**
 * Full manifest for a trip the driver owns: occupancy, each booking with passenger first name.
 * Used on the active-trip detail screen.
 */
export function useTripManifest(tripId: string | null) {
  return useQuery({
    queryKey: queryKeys.tripManifest(tripId ?? ''),
    queryFn: () => {
      if (!supabase || !tripId) throw new Error('Supabase not configured or missing trip ID');
      return fetchTripManifest(supabase, tripId);
    },
    enabled: !!supabase && !!tripId,
  });
}
