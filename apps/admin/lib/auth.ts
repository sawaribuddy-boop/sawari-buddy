import { createClient } from '@/lib/supabase/server';
import { USER_ROLE } from '@sawari/constants';
import { redirect } from 'next/navigation';

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== USER_ROLE.ADMIN) {
    await supabase.auth.signOut();
    redirect('/login');
  }

  return { user, profile };
}
