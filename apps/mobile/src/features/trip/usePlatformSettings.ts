import { useQuery } from '@tanstack/react-query';

import { fetchPlatformSettings } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

/** Public platform settings (heartbeat interval, max seats, etc). */
export function usePlatformSettings() {
  return useQuery({
    queryKey: queryKeys.platformSettings,
    queryFn: () => {
      if (!supabase) throw new Error('Supabase not configured');
      return fetchPlatformSettings(supabase);
    },
    staleTime: 5 * 60_000,
    enabled: !!supabase,
  });
}
