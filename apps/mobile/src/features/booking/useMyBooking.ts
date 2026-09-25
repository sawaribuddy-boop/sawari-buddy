import { useQuery } from '@tanstack/react-query';

import { fetchMyBooking } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

/**
 * Single booking detail for the calling passenger. Returns the full booking object
 * with trip, route, auto, and driver info, or null if the booking doesn't exist
 * or doesn't belong to the caller.
 */
export function useMyBooking(bookingId: string | null) {
  return useQuery({
    queryKey: queryKeys.myBooking(bookingId ?? ''),
    queryFn: () => {
      if (!supabase || !bookingId) throw new Error('Supabase not configured or missing booking ID');
      return fetchMyBooking(supabase, bookingId);
    },
    enabled: !!supabase && !!bookingId,
  });
}
