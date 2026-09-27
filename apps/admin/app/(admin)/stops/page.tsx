import { createClient } from '@/lib/supabase/server';
import { StopsTable } from './StopsTable';

export default async function StopsPage() {
  const supabase = await createClient();
  const { data: stops } = await supabase
    .from('stops')
    .select('*')
    .order('name');

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24 }}>Stops</h1>
      <StopsTable stops={stops ?? []} />
    </div>
  );
}
