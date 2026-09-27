'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function adminCancelBooking(bookingId: string, tripId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_cancel_booking', { p_booking_id: bookingId });
  if (error) return error.message;
  revalidatePath(`/trips/${tripId}`);
  return null;
}

export async function adminCancelTrip(tripId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_trip', { p_trip_id: tripId });
  if (error) return error.message;
  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/trips');
  return null;
}

export async function adminResumeTrip(tripId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('resume_trip', { p_trip_id: tripId });
  if (error) return error.message;
  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/trips');
  return null;
}
