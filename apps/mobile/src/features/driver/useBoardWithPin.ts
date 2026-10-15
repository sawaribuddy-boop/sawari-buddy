import { useMutation } from '@tanstack/react-query';

import { boardWithPin } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export type BoardWithPinResult =
  | { ok: true; booking_id: string; passenger_first_name: string | null; seat_count: number; already_boarded: boolean }
  | { ok: false; reason: 'MISMATCH'; attempts_left: number }
  | { ok: false; reason: 'LOCKED'; retry_after_seconds: number };

export function useBoardWithPin(tripId: string) {
  return useMutation({
    mutationFn: async (pin: string) => {
      if (!supabase) throw new Error('Supabase not configured');
      return (await boardWithPin(supabase, tripId, pin)) as unknown as BoardWithPinResult;
    },
    onSuccess: (result) => {
      if (!result.ok) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.tripManifest(tripId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
    },
  });
}
