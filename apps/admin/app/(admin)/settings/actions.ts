'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateSettings(_prev: string | null, formData: FormData): Promise<string | null> {
  const commissionBps = Number(formData.get('commission_bps'));
  const walkInCommissionBps = Number(formData.get('walk_in_commission_bps'));
  const maxSeatsPerBooking = Number(formData.get('max_seats_per_booking'));
  const noShowGraceSeconds = Number(formData.get('no_show_grace_seconds'));
  const driverStaleSeconds = Number(formData.get('driver_stale_seconds'));

  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10000) {
    return 'Commission must be 0-10000 basis points.';
  }
  if (!Number.isInteger(walkInCommissionBps) || walkInCommissionBps < 0 || walkInCommissionBps > 10000) {
    return 'Walk-in commission must be 0-10000 basis points.';
  }
  if (!Number.isInteger(maxSeatsPerBooking) || maxSeatsPerBooking < 1 || maxSeatsPerBooking > 8) {
    return 'Max seats must be 1-8.';
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('platform_settings')
    .update({
      commission_bps: commissionBps,
      walk_in_commission_bps: walkInCommissionBps,
      max_seats_per_booking: maxSeatsPerBooking,
      no_show_grace_seconds: noShowGraceSeconds,
      driver_stale_seconds: driverStaleSeconds,
    })
    .eq('id', 1);

  if (error) return error.message;

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action: 'update_settings',
      target_type: 'platform_settings',
      target_id: '1',
      metadata: { commission_bps: commissionBps, walk_in_commission_bps: walkInCommissionBps },
    });
  }

  revalidatePath('/settings');
  return null;
}
