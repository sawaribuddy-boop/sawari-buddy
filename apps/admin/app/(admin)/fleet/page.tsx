import { createClient } from '@/lib/supabase/server';
import { FleetTable } from './FleetTable';

export default async function FleetPage() {
  const supabase = await createClient();

  const [{ data: autos }, { data: assignments }, { data: drivers }] = await Promise.all([
    supabase.from('autos').select('*').order('registration_number'),
    supabase
      .from('auto_assignments')
      .select('*, auto:autos(registration_number), driver:drivers!auto_assignments_driver_id_fkey(profile:profiles!drivers_id_fkey(full_name, email))')
      .is('revoked_at', null)
      .order('assigned_at', { ascending: false }),
    supabase
      .from('drivers')
      .select('id, profile:profiles!drivers_id_fkey(full_name, email)')
      .eq('status', 'ACTIVE'),
  ]);

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24 }}>Fleet</h1>
      <FleetTable
        autos={autos ?? []}
        assignments={assignments ?? []}
        activeDrivers={drivers ?? []}
      />
    </div>
  );
}
