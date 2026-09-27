import { useMutation } from '@tanstack/react-query';

import { addWalkIn } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export function useAddWalkIn() {
  return useMutation({
    mutationFn: (args: {
      tripId: string;
      seatCount: number;
      idempotencyKey: string;
      label?: string;
    }) => {
      if (!supabase) throw new Error('Supabase not configured');
      return addWalkIn(supabase, args);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tripManifest(variables.tripId) });
    },
  });
}
