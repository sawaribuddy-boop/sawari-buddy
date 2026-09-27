'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createRoute(_prev: string | null, formData: FormData): Promise<string | null> {
  const originStopId = formData.get('origin_stop_id') as string;
  const destinationStopId = formData.get('destination_stop_id') as string;
  const fareRupees = Number(formData.get('fare_rupees'));
  const displayOrder = Number(formData.get('display_order'));

  if (!originStopId || !destinationStopId) return 'Both stops are required.';
  if (originStopId === destinationStopId) return 'Origin and destination must be different.';
  if (!Number.isFinite(fareRupees) || fareRupees <= 0) return 'Fare must be a positive number.';
  if (!Number.isInteger(displayOrder) || displayOrder < 0) return 'Display order must be a non-negative integer.';

  const supabase = await createClient();
  const { error } = await supabase.from('routes').insert({
    origin_stop_id: originStopId,
    destination_stop_id: destinationStopId,
    fare_paise: Math.round(fareRupees * 100),
    display_order: displayOrder,
  });
  if (error) return error.message;

  revalidatePath('/routes');
  return null;
}

export async function updateRoute(_prev: string | null, formData: FormData): Promise<string | null> {
  const id = formData.get('id') as string;
  const fareRupees = Number(formData.get('fare_rupees'));
  const displayOrder = Number(formData.get('display_order'));

  if (!Number.isFinite(fareRupees) || fareRupees <= 0) return 'Fare must be a positive number.';
  if (!Number.isInteger(displayOrder) || displayOrder < 0) return 'Display order must be a non-negative integer.';

  const supabase = await createClient();
  const { error } = await supabase.from('routes').update({
    fare_paise: Math.round(fareRupees * 100),
    display_order: displayOrder,
  }).eq('id', id);
  if (error) return error.message;

  revalidatePath('/routes');
  return null;
}

export async function toggleRouteActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  await supabase.from('routes').update({ is_active: !isActive }).eq('id', id);
  revalidatePath('/routes');
}
