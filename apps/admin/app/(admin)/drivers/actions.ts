'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function inviteDriver(_prev: string | null, formData: FormData): Promise<string | null> {
  const email = (formData.get('email') as string)?.trim();
  const fullName = (formData.get('full_name') as string)?.trim();
  const licenseNumber = (formData.get('license_number') as string)?.trim().toUpperCase();

  if (!email) return 'Email is required.';
  if (!fullName) return 'Full name is required.';
  if (!licenseNumber || licenseNumber.length < 5 || licenseNumber.length > 30) {
    return 'License number must be 5-30 characters.';
  }

  const serviceClient = await createServiceClient();

  const { data: invite, error: inviteErr } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });
  if (inviteErr) return inviteErr.message;

  const userId = invite.user.id;

  const supabase = await createClient();

  const { error: roleErr } = await supabase.rpc('admin_set_user_role', {
    p_user_id: userId,
    p_role: 'DRIVER',
  });
  if (roleErr) return `Role assignment failed: ${roleErr.message}`;

  const { error: driverErr } = await serviceClient
    .from('drivers')
    .insert({ id: userId, license_number: licenseNumber });
  if (driverErr) return `Driver record failed: ${driverErr.message}`;

  await serviceClient
    .from('driver_presence')
    .insert({ driver_id: userId });

  revalidatePath('/drivers');
  return null;
}

export async function verifyDriver(driverId: string) {
  const supabase = await createClient();
  await supabase
    .from('drivers')
    .update({ status: 'ACTIVE', verified_at: new Date().toISOString() })
    .eq('id', driverId);
  revalidatePath('/drivers');
}

export async function suspendDriver(driverId: string) {
  const supabase = await createClient();
  await supabase
    .from('drivers')
    .update({ status: 'SUSPENDED' })
    .eq('id', driverId);
  revalidatePath('/drivers');
}

export async function reactivateDriver(driverId: string) {
  const supabase = await createClient();
  await supabase
    .from('drivers')
    .update({ status: 'ACTIVE', verified_at: new Date().toISOString() })
    .eq('id', driverId);
  revalidatePath('/drivers');
}
