'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function recordSettlement(_prev: string | null, formData: FormData): Promise<string | null> {
  const driverId = formData.get('driver_id') as string;
  const amountRupees = Number(formData.get('amount_rupees'));
  const description = (formData.get('description') as string)?.trim() || 'Cash settlement';

  if (!driverId) return 'Driver is required.';
  if (!Number.isFinite(amountRupees) || amountRupees <= 0) return 'Amount must be positive.';

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_settlement', {
    p_driver_id: driverId,
    p_amount_paise: Math.round(amountRupees * 100),
    p_description: description,
  });

  if (error) return error.message;
  revalidatePath('/ledger');
  return null;
}

export async function recordAdjustment(_prev: string | null, formData: FormData): Promise<string | null> {
  const driverId = formData.get('driver_id') as string;
  const amountRupees = Number(formData.get('amount_rupees'));
  const description = (formData.get('description') as string)?.trim();

  if (!driverId) return 'Driver is required.';
  if (!Number.isFinite(amountRupees) || amountRupees === 0) return 'Amount must be non-zero.';
  if (!description) return 'Description is required for adjustments.';

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_adjustment', {
    p_driver_id: driverId,
    p_amount_paise: Math.round(amountRupees * 100),
    p_description: description,
  });

  if (error) return error.message;
  revalidatePath('/ledger');
  return null;
}
