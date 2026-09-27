import { useQuery } from '@tanstack/react-query';

import { fetchRoutes } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

/** All active routes, for displaying fares and distances. Stable data, long staleTime. */
export function useRoutes() {
  return useQuery({
    queryKey: queryKeys.routes,
    queryFn: () => {
      if (!supabase) throw new Error('Supabase not configured');
      return fetchRoutes(supabase);
    },
    staleTime: 5 * 60_000,
    enabled: !!supabase,
  });
}
