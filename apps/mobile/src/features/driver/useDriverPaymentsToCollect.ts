import type { BookingSource, PaymentStatus } from '@sawari/constants';
import { useQuery } from '@tanstack/react-query';

import { fetchDriverPaymentsToCollect } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export interface PaymentToCollect {
  id: string;
  code: string;
  source: BookingSource;
  payment_status: PaymentStatus;
  seat_count: number;
  total_fare_paise: number;
  passenger_first_name: string | null;
  walk_in_label: string | null;
  trip_id: string;
  origin: string;
  destination: string;
  completed_at: string;
}

export interface PaymentsToCollect {
  pending_count: number;
  bookings: PaymentToCollect[];
}

/** Bookings whose cash payment the driver still has to confirm, plus the rest of their latest trip. */
export function useDriverPaymentsToCollect() {
  return useQuery({
    queryKey: queryKeys.driverPaymentsToCollect,
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase not configured');
      return (await fetchDriverPaymentsToCollect(supabase)) as unknown as PaymentsToCollect;
    },
    enabled: !!supabase,
  });
}
