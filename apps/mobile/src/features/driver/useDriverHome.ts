import { useQuery } from '@tanstack/react-query';

import { fetchDriverHome } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

/**
 * Driver dashboard: presence, active trip (with manifest), auto, today's earnings.
 * Refetched automatically when a realtime event arrives on the active trip channel.
 */
export function useDriverHome() {
  return useQuery({
    queryKey: queryKeys.driverHome,
    queryFn: () => {
      if (!supabase) throw new Error('Supabase not configured');
      return fetchDriverHome(supabase);
    },
    enabled: !!supabase,
  });
}
