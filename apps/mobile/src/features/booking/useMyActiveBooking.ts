import { useQuery } from '@tanstack/react-query';

import { fetchMyActiveBooking } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

/**
 * The calling passenger's current CONFIRMED or BOARDED booking, or null.
 * Realtime events on the trip channel invalidate this automatically.
 */
export function useMyActiveBooking() {
  return useQuery({
    queryKey: queryKeys.myActiveBooking,
    queryFn: () => {
      if (!supabase) throw new Error('Supabase not configured');
      return fetchMyActiveBooking(supabase);
    },
    enabled: !!supabase,
  });
}
