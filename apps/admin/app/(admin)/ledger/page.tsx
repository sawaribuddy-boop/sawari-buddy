import { createClient } from '@/lib/supabase/server';
import { formatRupees } from '@sawari/domain';
import { LedgerForms } from './LedgerForms';

export default async function LedgerPage() {
  const supabase = await createClient();

  const [{ data: balances }, { data: transactions }, { data: drivers }] = await Promise.all([
    supabase.from('ledger_account_balances').select('*').order('type'),
    supabase
      .from('ledger_transactions')
      .select('*, entries:ledger_entries(entry_type, amount_paise, account:ledger_accounts(type, owner_profile_id))')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('drivers')
      .select('id, profile:profiles!drivers_id_fkey(full_name, email)')
      .eq('status', 'ACTIVE'),
  ]);

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24 }}>Ledger</h1>

      <h2 style={styles.sectionTitle}>Account Balances</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Account Type</th>
            <th style={styles.th}>Balance</th>
            <th style={styles.th}>Entries</th>
          </tr>
        </thead>
        <tbody>
          {(balances ?? []).map((b, i) => (
            <tr key={i}>
              <td style={styles.td}>{b.type?.replace(/_/g, ' ') ?? '—'}</td>
              <td style={styles.td}>{b.balance_paise != null ? formatRupees(b.balance_paise) : '—'}</td>
              <td style={styles.td}>{b.entry_count ?? 0}</td>
            </tr>
          ))}
          {(!balances || balances.length === 0) && (
            <tr>
              <td colSpan={3} style={{ ...styles.td, color: '#9ca3af', textAlign: 'center' }}>
                No ledger activity yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 style={{ ...styles.sectionTitle, marginTop: 32 }}>Recent Transactions</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Type</th>
            <th style={styles.th}>Description</th>
            <th style={styles.th}>Entries</th>
            <th style={styles.th}>Date</th>
          </tr>
        </thead>
        <tbody>
          {(transactions ?? []).map((tx) => (
            <tr key={tx.id}>
              <td style={styles.td}>
                <span style={typeBadge(tx.type)}>{tx.type}</span>
              </td>
              <td style={styles.td}>{tx.description}</td>
              <td style={{ ...styles.td, fontSize: 12, color: '#6b7280' }}>
                {(tx.entries as { entry_type: string; amount_paise: number }[])?.map((e, i) => (
                  <div key={i}>{e.entry_type}: {formatRupees(e.amount_paise)}</div>
                ))}
              </td>
              <td style={styles.td}>{new Date(tx.created_at).toLocaleString()}</td>
            </tr>
          ))}
          {(!transactions || transactions.length === 0) && (
            <tr>
              <td colSpan={4} style={{ ...styles.td, color: '#9ca3af', textAlign: 'center' }}>
                No transactions yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <LedgerForms drivers={drivers ?? []} />
    </div>
  );
}

function typeBadge(type: string): React.CSSProperties {
  const base: React.CSSProperties = { padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500 };
  switch (type) {
    case 'PAYMENT': return { ...base, background: '#dbeafe', color: '#1e40af' };
    case 'SETTLEMENT': return { ...base, background: '#dcfce7', color: '#166534' };
    case 'ADJUSTMENT': return { ...base, background: '#fef3c7', color: '#92400e' };
    default: return { ...base, background: '#f3f4f6', color: '#374151' };
  }
}

const styles = {
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: '0 0 16px',
  } as React.CSSProperties,
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
