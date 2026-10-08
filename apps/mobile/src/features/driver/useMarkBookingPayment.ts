import { useMutation } from '@tanstack/react-query';

import { markBookingPayment } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export function useMarkBookingPayment() {
  return useMutation({
    mutationFn: ({ bookingId, received }: { bookingId: string; received: boolean }) => {
      if (!supabase) throw new Error('Supabase not configured');
      return markBookingPayment(supabase, bookingId, received);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverPaymentsToCollect });
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
      void queryClient.invalidateQueries({ queryKey: ['driver-earnings'] }); // every period
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverTripHistory });
    },
  });
}
