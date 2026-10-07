import { useMutation } from '@tanstack/react-query';

import { type IssueKind, raiseIssue } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export function useRaiseIssue() {
  return useMutation({
    mutationFn: (issue: { kind: IssueKind; description: string; bookingId?: string; tripId?: string }) => {
      if (!supabase) throw new Error('Supabase not configured');
      return raiseIssue(supabase, issue);
    },
  });
}
