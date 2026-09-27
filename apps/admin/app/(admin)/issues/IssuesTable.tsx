'use client';

import { useActionState, useState } from 'react';
import { resolveIssue, closeIssue, assignIssue } from './actions';

interface IssueRow {
  id: string;
  kind: string;
  source: string;
  status: string;
  description: string;
  resolution_note: string | null;
  created_at: string;
  trip_id: string | null;
  raised_by_profile: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
}

export function IssuesTable({ issues }: { issues: IssueRow[] }) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveError, resolveAction, resolvePending] = useActionState(resolveIssue, null);

  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Kind</th>
          <th style={styles.th}>Source</th>
          <th style={styles.th}>Raised by</th>
          <th style={styles.th}>Description</th>
          <th style={styles.th}>Status</th>
          <th style={styles.th}>Created</th>
          <th style={styles.th}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {issues.map((issue) => (
          <tr key={issue.id}>
            <td style={styles.td}>{issue.kind.replace(/_/g, ' ')}</td>
            <td style={styles.td}>{issue.source}</td>
            <td style={styles.td}>{profileName(issue.raised_by_profile)}</td>
            <td style={{ ...styles.td, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {issue.description}
            </td>
            <td style={styles.td}><span style={statusBadge(issue.status)}>{issue.status}</span></td>
            <td style={styles.td}>{new Date(issue.created_at).toLocaleDateString()}</td>
            <td style={styles.td}>
              {issue.status === 'OPEN' && (
                <form action={async () => { await assignIssue(issue.id); }} style={{ display: 'inline' }}>
                  <button type="submit" style={styles.btnAction}>Take</button>
                </form>
              )}
              {(issue.status === 'OPEN' || issue.status === 'IN_REVIEW') && (
                resolvingId === issue.id ? (
                  <form action={resolveAction} style={styles.resolveForm}>
                    <input type="hidden" name="id" value={issue.id} />
                    <input name="resolution_note" placeholder="Resolution note" style={styles.input} required />
                    <button type="submit" disabled={resolvePending} style={styles.btnSave}>Resolve</button>
                    <button type="button" onClick={() => setResolvingId(null)} style={styles.btnCancel}>X</button>
                    {resolveError && <span style={styles.error}>{resolveError}</span>}
                  </form>
                ) : (
                  <button onClick={() => setResolvingId(issue.id)} style={styles.btnResolve}>Resolve</button>
                )
              )}
              {issue.status === 'RESOLVED' && (
                <form action={async () => { await closeIssue(issue.id); }} style={{ display: 'inline' }}>
                  <button type="submit" style={styles.btnClose}>Close</button>
                </form>
              )}
            </td>
          </tr>
        ))}
        {issues.length === 0 && (
          <tr>
            <td colSpan={7} style={{ ...styles.td, color: '#9ca3af', textAlign: 'center' }}>
              No issues.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function profileName(p: IssueRow['raised_by_profile']): string {
  if (!p) return '—';
  const v = Array.isArray(p) ? p[0] : p;
  return v?.full_name ?? v?.email ?? '—';
}

function statusBadge(status: string): React.CSSProperties {
  const base: React.CSSProperties = { padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500 };
  switch (status) {
    case 'OPEN': return { ...base, background: '#fee2e2', color: '#991b1b' };
    case 'IN_REVIEW': return { ...base, background: '#fef3c7', color: '#92400e' };
    case 'RESOLVED': return { ...base, background: '#dcfce7', color: '#166534' };
    case 'CLOSED': return { ...base, background: '#f3f4f6', color: '#374151' };
    default: return base;
  }
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
  resolveForm: {
    display: 'inline-flex',
    gap: 4,
    alignItems: 'center',
  },
  input: {
    padding: '4px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 13,
    width: 160,
  },
  btnAction: {
    padding: '3px 8px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    marginRight: 4,
  },
  btnResolve: {
    padding: '3px 8px',
    background: '#1a7a3a',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    marginLeft: 4,
  },
  btnClose: {
    padding: '3px 8px',
    background: '#6b7280',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
  btnSave: {
    padding: '3px 8px',
    background: '#1a7a3a',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
  btnCancel: {
    padding: '3px 6px',
    background: '#e5e7eb',
    color: '#374151',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
  error: {
    color: '#dc2626',
    fontSize: 12,
  },
};
