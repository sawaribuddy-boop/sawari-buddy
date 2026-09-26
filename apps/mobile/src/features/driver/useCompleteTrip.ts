import { useMutation } from '@tanstack/react-query';

import { completeTrip } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export function useCompleteTrip() {
  return useMutation({
    mutationFn: (tripId: string) => {
      if (!supabase) throw new Error('Supabase not configured');
      return completeTrip(supabase, tripId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverEarnings() });
    },
  });
}
