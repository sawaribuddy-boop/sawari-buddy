import type { Database } from '@sawari/types';
import { useMutation } from '@tanstack/react-query';

import { cancelTrip } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

type TripCancelReason = Database['public']['Enums']['trip_cancel_reason'];

export function useCancelTrip() {
  return useMutation({
    mutationFn: (args: { tripId: string; reason?: TripCancelReason }) => {
      if (!supabase) throw new Error('Supabase not configured');
      return cancelTrip(supabase, args.tripId, args.reason);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
    },
  });
}
