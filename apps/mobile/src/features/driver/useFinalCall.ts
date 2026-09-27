import { useMutation } from '@tanstack/react-query';

import { finalCall } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export function useFinalCall() {
  return useMutation({
    mutationFn: (tripId: string) => {
      if (!supabase) throw new Error('Supabase not configured');
      return finalCall(supabase, tripId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
    },
  });
}
