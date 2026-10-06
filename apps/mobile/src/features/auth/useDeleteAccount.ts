import { useMutation } from '@tanstack/react-query';

import { deleteMyAccount } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

import { useAuth } from './AuthProvider';

/**
 * Deletes the signed-in user's account (anonymised on the server; see delete_my_account),
 * then ends the session on this device and drops all cached data.
 */
export function useDeleteAccount() {
  const { signOut } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error('Supabase not configured');
      await deleteMyAccount(supabase);
    },
    onSuccess: async () => {
      queryClient.clear();
      await signOut();
    },
  });
}
