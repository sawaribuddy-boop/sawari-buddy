import { createClient } from '@/lib/supabase/server';
import { SettingsForm } from './SettingsForm';

export default async function SettingsPage() {
  const supabase = await createClient();

  const [{ data: settings }, { data: auditLog }] = await Promise.all([
    supabase.from('platform_settings').select('*').eq('id', 1).single(),
    supabase
      .from('admin_actions')
      .select('*, admin:profiles!admin_actions_admin_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24 }}>Settings</h1>

      {settings && <SettingsForm settings={settings} />}

      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '40px 0 16px' }}>Admin Audit Log</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Admin</th>
            <th style={styles.th}>Action</th>
            <th style={styles.th}>Target</th>
            <th style={styles.th}>Date</th>
          </tr>
        </thead>
        <tbody>
          {(auditLog ?? []).map((entry) => {
            const adminName = Array.isArray(entry.admin)
              ? entry.admin[0]?.full_name
              : (entry.admin as { full_name: string | null } | null)?.full_name;
            return (
              <tr key={entry.id}>
                <td style={styles.td}>{adminName ?? '—'}</td>
                <td style={styles.td}>{entry.action}</td>
                <td style={styles.td}>{entry.target_type ? `${entry.target_type}:${entry.target_id}` : '—'}</td>
                <td style={styles.td}>{new Date(entry.created_at).toLocaleString()}</td>
              </tr>
            );
          })}
          {(!auditLog || auditLog.length === 0) && (
            <tr>
              <td colSpan={4} style={{ ...styles.td, color: '#9ca3af', textAlign: 'center' }}>
                No audit entries yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    background: '#fff',
    borderRadius: 8,
    overflow: 'hidden' as const,
    border: '1px solid #e5e7eb',
  },
  th: {
    textAlign: 'left' as const,
    padding: '10px 12px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: 14,
  },
};
