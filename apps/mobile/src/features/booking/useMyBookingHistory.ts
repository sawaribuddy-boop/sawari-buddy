import { useInfiniteQuery } from '@tanstack/react-query';

import { fetchMyBookingHistory } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 20;

/**
 * Paginated booking history (all statuses). Uses cursor-based infinite query:
 * pass the last row's `created_at` as the cursor for the next page.
 */
export function useMyBookingHistory() {
  return useInfiniteQuery({
    queryKey: queryKeys.myBookingHistory(),
    queryFn: ({ pageParam }) => {
      if (!supabase) throw new Error('Supabase not configured');
      return fetchMyBookingHistory(supabase, { limit: PAGE_SIZE, before: pageParam });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage || !Array.isArray(lastPage) || lastPage.length < PAGE_SIZE) return undefined;
      const last = lastPage[lastPage.length - 1] as { created_at?: string } | undefined;
      return last?.created_at;
    },
    enabled: !!supabase,
  });
}
