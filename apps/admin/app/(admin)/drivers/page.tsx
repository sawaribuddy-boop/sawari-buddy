import { createClient } from '@/lib/supabase/server';
import { DriversTable } from './DriversTable';

export default async function DriversPage() {
  const supabase = await createClient();

  const { data: drivers } = await supabase
    .from('drivers')
    .select('*, profile:profiles!drivers_id_fkey(email, full_name)')
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24 }}>Drivers</h1>
      <DriversTable drivers={drivers ?? []} />
    </div>
  );
}
