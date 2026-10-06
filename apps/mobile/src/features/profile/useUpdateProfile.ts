import { useMutation } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { updateMyProfile } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export function useUpdateProfile() {
  const { account, refreshAccount } = useAuth();
  return useMutation({
    mutationFn: (changes: { fullName: string; phone: string | null }) => {
      if (!supabase || !account) throw new Error('Supabase not configured');
      return updateMyProfile(supabase, account.userId, changes);
    },
    onSuccess: () => refreshAccount(),
  });
}
