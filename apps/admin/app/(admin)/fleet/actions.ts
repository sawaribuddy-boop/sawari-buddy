'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createAuto(_prev: string | null, formData: FormData): Promise<string | null> {
  const registrationNumber = (formData.get('registration_number') as string)?.trim().toUpperCase();
  const capacity = Number(formData.get('capacity'));
  const model = (formData.get('model') as string)?.trim() || null;
  const colour = (formData.get('colour') as string)?.trim() || null;

  if (!registrationNumber) return 'Registration number is required.';
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) return 'Capacity must be 1-20.';

  const supabase = await createClient();
  const { error } = await supabase.from('autos').insert({
    registration_number: registrationNumber,
    capacity,
    model,
    colour,
  });
  if (error) return error.message;

  revalidatePath('/fleet');
  return null;
}

export async function updateAuto(_prev: string | null, formData: FormData): Promise<string | null> {
  const id = formData.get('id') as string;
  const registrationNumber = (formData.get('registration_number') as string)?.trim().toUpperCase();
  const capacity = Number(formData.get('capacity'));
  const model = (formData.get('model') as string)?.trim() || null;
  const colour = (formData.get('colour') as string)?.trim() || null;

  if (!registrationNumber) return 'Registration number is required.';
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) return 'Capacity must be 1-20.';

  const supabase = await createClient();
  const { error } = await supabase.from('autos').update({
    registration_number: registrationNumber,
    capacity,
    model,
    colour,
  }).eq('id', id);
  if (error) return error.message;

  revalidatePath('/fleet');
  return null;
}

export async function toggleAutoActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  const status = isActive ? 'INACTIVE' : 'ACTIVE';
  await supabase.from('autos').update({ status }).eq('id', id);
  revalidatePath('/fleet');
}

export async function assignDriver(_prev: string | null, formData: FormData): Promise<string | null> {
  const autoId = formData.get('auto_id') as string;
  const driverId = formData.get('driver_id') as string;

  if (!autoId || !driverId) return 'Both auto and driver are required.';

  const supabase = await createClient();
  const { error } = await supabase.from('auto_assignments').insert({
    auto_id: autoId,
    driver_id: driverId,
  });
  if (error) return error.message;

  revalidatePath('/fleet');
  return null;
}

export async function revokeAssignment(assignmentId: string) {
  const supabase = await createClient();
  await supabase
    .from('auto_assignments')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', assignmentId);
  revalidatePath('/fleet');
}
