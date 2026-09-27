import { createClient } from '@/lib/supabase/server';
import { formatRupees } from '@sawari/domain';
import { RoutesTable } from './RoutesTable';

export default async function RoutesPage() {
  const supabase = await createClient();

  const [{ data: routes }, { data: stops }] = await Promise.all([
    supabase
      .from('routes')
      .select('*, origin:stops!routes_origin_stop_id_fkey(name), destination:stops!routes_destination_stop_id_fkey(name)')
      .order('display_order'),
    supabase.from('stops').select('id, name').eq('is_active', true).order('name'),
  ]);

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24 }}>Routes</h1>
      <RoutesTable routes={routes ?? []} stops={stops ?? []} formatRupees={formatRupees} />
    </div>
  );
}
