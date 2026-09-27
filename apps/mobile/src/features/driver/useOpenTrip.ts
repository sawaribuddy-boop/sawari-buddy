import { useMutation } from '@tanstack/react-query';

import { openTrip } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export function useOpenTrip() {
  return useMutation({
    mutationFn: (args: { autoId: string; routeId: string }) => {
      if (!supabase) throw new Error('Supabase not configured');
      return openTrip(supabase, args.autoId, args.routeId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
    },
  });
}
