import { useMutation } from '@tanstack/react-query';

import { cancelBooking } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export function useCancelBooking() {
  return useMutation({
    mutationFn: (bookingId: string) => {
      if (!supabase) throw new Error('Supabase not configured');
      return cancelBooking(supabase, bookingId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myActiveBooking });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myBookingHistory() });
      void queryClient.invalidateQueries({ queryKey: ['my-booking'] });
    },
  });
}
