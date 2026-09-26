import { useMutation } from '@tanstack/react-query';

import { startTrip } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export function useStartTrip() {
  return useMutation({
    mutationFn: (tripId: string) => {
      if (!supabase) throw new Error('Supabase not configured');
      return startTrip(supabase, tripId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
    },
  });
}
