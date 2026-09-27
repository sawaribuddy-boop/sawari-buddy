import { useQuery } from '@tanstack/react-query';

import { fetchDriverEarnings } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

/**
 * Earnings summary for the current driver. Defaults to "today" (IST).
 * The earnings endpoint already enforces driver-only access.
 */
export function useDriverEarnings(opts: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.driverEarnings(opts.from, opts.to),
    queryFn: () => {
      if (!supabase) throw new Error('Supabase not configured');
      return fetchDriverEarnings(supabase, opts);
    },
    enabled: !!supabase,
  });
}
