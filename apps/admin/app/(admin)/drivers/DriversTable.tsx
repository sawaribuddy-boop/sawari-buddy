'use client';

import { useActionState } from 'react';
import { inviteDriver, verifyDriver, suspendDriver, reactivateDriver } from './actions';

interface DriverRow {
  id: string;
  license_number: string;
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED';
  verified_at: string | null;
  created_at: string;
  profile: { email: string | null; full_name: string | null } | null;
}

export function DriversTable({ drivers }: { drivers: DriverRow[] }) {
  const [inviteError, inviteAction, invitePending] = useActionState(inviteDriver, null);

  return (
    <div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>License</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.id}>
              <td style={styles.td}>{d.profile?.full_name ?? '—'}</td>
              <td style={styles.td}>{d.profile?.email ?? '—'}</td>
              <td style={styles.td}>{d.license_number}</td>
              <td style={styles.td}>
                <span style={statusBadge(d.status)}>{formatStatus(d.status)}</span>
              </td>
              <td style={styles.td}>
                {d.status === 'PENDING_VERIFICATION' && (
                  <form action={() => verifyDriver(d.id)} style={{ display: 'inline' }}>
                    <button type="submit" style={styles.btnAction}>Verify</button>
                  </form>
                )}
                {d.status === 'ACTIVE' && (
                  <form action={() => suspendDriver(d.id)} style={{ display: 'inline' }}>
                    <button type="submit" style={styles.btnDanger}>Suspend</button>
                  </form>
                )}
                {d.status === 'SUSPENDED' && (
                  <form action={() => reactivateDriver(d.id)} style={{ display: 'inline' }}>
                    <button type="submit" style={styles.btnAction}>Reactivate</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {drivers.length === 0 && (
            <tr>
              <td colSpan={5} style={{ ...styles.td, color: '#9ca3af', textAlign: 'center' }}>
                No drivers yet. Invite one below.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3 style={{ margin: '24px 0 12px', fontSize: 16 }}>Invite Driver</h3>
      <form action={inviteAction} style={styles.inlineForm}>
        <input name="email" type="email" placeholder="Email" style={styles.input} required />
        <input name="full_name" placeholder="Full name" style={styles.input} required />
        <input name="license_number" placeholder="License number" style={styles.input} required />
        <button type="submit" disabled={invitePending} style={styles.btnSave}>
          {invitePending ? 'Inviting…' : 'Invite'}
        </button>
        {inviteError && <span style={styles.error}>{inviteError}</span>}
      </form>
    </div>
  );
}

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function statusBadge(status: string): React.CSSProperties {
  const base: React.CSSProperties = { padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500 };
  if (status === 'ACTIVE') return { ...base, background: '#dcfce7', color: '#166534' };
  if (status === 'SUSPENDED') return { ...base, background: '#fee2e2', color: '#991b1b' };
  return { ...base, background: '#fef3c7', color: '#92400e' };
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
  inlineForm: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  input: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 14,
    width: 180,
  },
  btnSave: {
    padding: '6px 14px',
    background: '#1a7a3a',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnAction: {
    padding: '4px 10px',
    background: '#1a7a3a',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    marginRight: 4,
  },
  btnDanger: {
    padding: '4px 10px',
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
  },
};
