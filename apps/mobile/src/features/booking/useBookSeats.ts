import { useMutation } from '@tanstack/react-query';

import { bookSeats } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export function useBookSeats() {
  return useMutation({
    mutationFn: (args: {
      tripId: string;
      seatCount: number;
      idempotencyKey: string;
      seatPreference: 'ANY' | 'BACK' | 'FRONT';
    }) => {
      if (!supabase) throw new Error('Supabase not configured');
      return bookSeats(supabase, args);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myActiveBooking });
      void queryClient.invalidateQueries({ queryKey: ['search-trips'] });
    },
  });
}
