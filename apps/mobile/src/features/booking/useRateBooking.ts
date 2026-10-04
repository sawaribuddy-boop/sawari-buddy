import { useMutation } from '@tanstack/react-query';

import { rateBooking } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export interface RateBookingInput {
  bookingId: string;
  stars: number;
  comment?: string;
}

export function useRateBooking() {
  return useMutation({
    mutationFn: ({ bookingId, stars, comment }: RateBookingInput) => {
      if (!supabase) throw new Error('Supabase not configured');
      return rateBooking(supabase, bookingId, stars, comment);
    },
    onSettled: () => {
      // Also on error: ALREADY_RATED means another device rated it, so the prompt should go away.
      void queryClient.invalidateQueries({ queryKey: queryKeys.myPendingRating });
      void queryClient.invalidateQueries({ queryKey: ['my-booking-history'] });
      void queryClient.invalidateQueries({ queryKey: ['my-booking'] });
    },
  });
}
