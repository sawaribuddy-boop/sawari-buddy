'use server';

import { createClient } from '@/lib/supabase/server';
import { USER_ROLE } from '@sawari/constants';
import { redirect } from 'next/navigation';

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) return 'Email and password are required.';

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return 'Invalid email or password.';

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'Invalid email or password.';

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== USER_ROLE.ADMIN) {
    await supabase.auth.signOut();
    return 'Access denied. Admin accounts only.';
  }

  redirect('/');
}
