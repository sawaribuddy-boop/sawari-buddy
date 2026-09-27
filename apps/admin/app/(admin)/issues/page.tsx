import { createClient } from '@/lib/supabase/server';
import { IssuesTable } from './IssuesTable';

export default async function IssuesPage() {
  const supabase = await createClient();

  const { data: issues } = await supabase
    .from('issues')
    .select('*, raised_by_profile:profiles!issues_raised_by_fkey(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24 }}>Issues</h1>
      <IssuesTable issues={issues ?? []} />
    </div>
  );
}
