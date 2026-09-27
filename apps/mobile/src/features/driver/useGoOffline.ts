import { useMutation } from '@tanstack/react-query';

import { goOffline } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export function useGoOffline() {
  return useMutation({
    mutationFn: () => {
      if (!supabase) throw new Error('Supabase not configured');
      return goOffline(supabase);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
    },
  });
}
