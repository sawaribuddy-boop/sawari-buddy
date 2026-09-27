'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function resolveIssue(_prev: string | null, formData: FormData): Promise<string | null> {
  const id = formData.get('id') as string;
  const resolutionNote = (formData.get('resolution_note') as string)?.trim();

  if (!resolutionNote) return 'Resolution note is required.';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('issues')
    .update({
      status: 'RESOLVED',
      resolution_note: resolutionNote,
      resolved_at: new Date().toISOString(),
      assigned_to: user?.id ?? null,
    })
    .eq('id', id);

  if (error) return error.message;
  revalidatePath('/issues');
  return null;
}

export async function closeIssue(id: string) {
  const supabase = await createClient();
  await supabase.from('issues').update({ status: 'CLOSED' }).eq('id', id);
  revalidatePath('/issues');
}

export async function assignIssue(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('issues').update({ status: 'IN_REVIEW', assigned_to: user?.id ?? null }).eq('id', id);
  revalidatePath('/issues');
}
