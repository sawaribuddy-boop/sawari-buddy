import { useInfiniteQuery } from '@tanstack/react-query';

import { fetchDriverTripHistory } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 20;

export interface DriverTripHistoryItem {
  id: string;
  status: 'COMPLETED' | 'CANCELLED';
  cancel_reason: string | null;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  origin: string;
  destination: string;
  auto_registration: string;
  passenger_count: number;
  seat_count: number;
  fare_paise: number;
  platform_fee_paise: number;
  unpaid_count: number;
  payment_pending_count: number;
}

/** The driver's completed and cancelled trips, newest first (cursor: last row's created_at). */
export function useDriverTripHistory({ enabled = true }: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.driverTripHistory,
    queryFn: async ({ pageParam }) => {
      if (!supabase) throw new Error('Supabase not configured');
      const page = await fetchDriverTripHistory(supabase, { limit: PAGE_SIZE, before: pageParam });
      return (Array.isArray(page) ? page : []) as unknown as DriverTripHistoryItem[];
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.length < PAGE_SIZE ? undefined : lastPage[lastPage.length - 1]?.created_at),
    enabled: enabled && !!supabase,
  });
}
