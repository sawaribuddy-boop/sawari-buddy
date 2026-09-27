'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createStop(_prev: string | null, formData: FormData): Promise<string | null> {
  const name = (formData.get('name') as string)?.trim();
  const lat = Number(formData.get('lat'));
  const lng = Number(formData.get('lng'));

  if (!name) return 'Name is required.';
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.';
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'Longitude must be between -180 and 180.';

  const supabase = await createClient();
  const { error } = await supabase.from('stops').insert({ name, lat, lng });
  if (error) return error.message;

  revalidatePath('/stops');
  return null;
}

export async function updateStop(_prev: string | null, formData: FormData): Promise<string | null> {
  const id = formData.get('id') as string;
  const name = (formData.get('name') as string)?.trim();
  const lat = Number(formData.get('lat'));
  const lng = Number(formData.get('lng'));

  if (!name) return 'Name is required.';
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.';
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'Longitude must be between -180 and 180.';

  const supabase = await createClient();
  const { error } = await supabase.from('stops').update({ name, lat, lng }).eq('id', id);
  if (error) return error.message;

  revalidatePath('/stops');
  return null;
}

export async function toggleStopActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  await supabase.from('stops').update({ is_active: !isActive }).eq('id', id);
  revalidatePath('/stops');
}
