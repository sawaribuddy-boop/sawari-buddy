import { useMutation } from '@tanstack/react-query';

import { removeWalkIn } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export function useRemoveWalkIn() {
  return useMutation({
    mutationFn: (bookingId: string) => {
      if (!supabase) throw new Error('Supabase not configured');
      return removeWalkIn(supabase, bookingId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
    },
  });
}
