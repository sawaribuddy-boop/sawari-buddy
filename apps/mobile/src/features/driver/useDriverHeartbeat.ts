import { useMutation } from '@tanstack/react-query';

import { driverHeartbeat } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export function useDriverHeartbeat() {
  return useMutation({
    mutationFn: (args: { lat?: number; lng?: number; accuracyM?: number }) => {
      if (!supabase) throw new Error('Supabase not configured');
      return driverHeartbeat(supabase, args);
    },
  });
}
