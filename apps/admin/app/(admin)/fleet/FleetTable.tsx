'use client';

import type { Auto } from '@sawari/types';
import { useActionState, useState } from 'react';
import { createAuto, updateAuto, toggleAutoActive, assignDriver, revokeAssignment } from './actions';

interface Assignment {
  id: string;
  auto_id: string;
  driver_id: string;
  auto: { registration_number: string } | null;
  driver: { profile: { full_name: string | null; email: string | null } | null } | null;
}

interface ActiveDriver {
  id: string;
  profile: { full_name: string | null; email: string | null } | null;
}

export function FleetTable({
  autos,
  assignments,
  activeDrivers,
}: {
  autos: Auto[];
  assignments: Assignment[];
  activeDrivers: ActiveDriver[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createError, createAction, createPending] = useActionState(createAuto, null);
  const [updateError, updateAction, updatePending] = useActionState(updateAuto, null);
  const [assignError, assignAction, assignPending] = useActionState(assignDriver, null);

  return (
    <div>
      <h2 style={styles.sectionTitle}>Autos</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Registration</th>
            <th style={styles.th}>Model</th>
            <th style={styles.th}>Colour</th>
            <th style={styles.th}>Capacity</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {autos.map((auto) =>
            editingId === auto.id ? (
              <tr key={auto.id}>
                <td colSpan={6} style={styles.td}>
                  <form action={updateAction} style={styles.inlineForm}>
                    <input type="hidden" name="id" value={auto.id} />
                    <input name="registration_number" defaultValue={auto.registration_number} style={styles.input} required />
                    <input name="model" defaultValue={auto.model ?? ''} placeholder="Model" style={styles.input} />
                    <input name="colour" defaultValue={auto.colour ?? ''} placeholder="Colour" style={styles.inputSm} />
                    <input name="capacity" type="number" defaultValue={auto.capacity} style={styles.inputXs} required />
                    <button type="submit" disabled={updatePending} style={styles.btnSave}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)} style={styles.btnCancel}>Cancel</button>
                    {updateError && <span style={styles.error}>{updateError}</span>}
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={auto.id}>
                <td style={styles.td}>{auto.registration_number}</td>
                <td style={styles.td}>{auto.model ?? '—'}</td>
                <td style={styles.td}>{auto.colour ?? '—'}</td>
                <td style={styles.td}>{auto.capacity}</td>
                <td style={styles.td}>
                  <form action={() => toggleAutoActive(auto.id, auto.status === 'ACTIVE')}>
                    <button type="submit" style={auto.status === 'ACTIVE' ? styles.badgeActive : styles.badgeInactive}>
                      {auto.status}
                    </button>
                  </form>
                </td>
                <td style={styles.td}>
                  <button onClick={() => setEditingId(auto.id)} style={styles.btnEdit}>Edit</button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      <h3 style={{ margin: '24px 0 12px', fontSize: 16 }}>Add Auto</h3>
      <form action={createAction} style={styles.inlineForm}>
        <input name="registration_number" placeholder="Reg. number" style={styles.input} required />
        <input name="model" placeholder="Model" style={styles.input} />
        <input name="colour" placeholder="Colour" style={styles.inputSm} />
        <input name="capacity" type="number" placeholder="Seats" defaultValue={5} style={styles.inputXs} required />
        <button type="submit" disabled={createPending} style={styles.btnSave}>
          {createPending ? 'Adding…' : 'Add'}
        </button>
        {createError && <span style={styles.error}>{createError}</span>}
      </form>

      <h2 style={{ ...styles.sectionTitle, marginTop: 40 }}>Assignments</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Auto</th>
            <th style={styles.th}>Driver</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a) => (
            <tr key={a.id}>
              <td style={styles.td}>{a.auto?.registration_number ?? a.auto_id}</td>
              <td style={styles.td}>{a.driver?.profile?.full_name ?? a.driver?.profile?.email ?? a.driver_id}</td>
              <td style={styles.td}>
                <form action={() => revokeAssignment(a.id)}>
                  <button type="submit" style={styles.btnDanger}>Revoke</button>
                </form>
              </td>
            </tr>
          ))}
          {assignments.length === 0 && (
            <tr>
              <td colSpan={3} style={{ ...styles.td, color: '#9ca3af', textAlign: 'center' }}>
                No active assignments.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3 style={{ margin: '24px 0 12px', fontSize: 16 }}>Assign Driver to Auto</h3>
      <form action={assignAction} style={styles.inlineForm}>
        <select name="auto_id" style={styles.select} required>
          <option value="">Select auto</option>
          {autos.filter((a) => a.status === 'ACTIVE').map((a) => (
            <option key={a.id} value={a.id}>{a.registration_number}</option>
          ))}
        </select>
        <select name="driver_id" style={styles.select} required>
          <option value="">Select driver</option>
          {activeDrivers.map((d) => (
            <option key={d.id} value={d.id}>{d.profile?.full_name ?? d.profile?.email ?? d.id}</option>
          ))}
        </select>
        <button type="submit" disabled={assignPending} style={styles.btnSave}>
          {assignPending ? 'Assigning…' : 'Assign'}
        </button>
        {assignError && <span style={styles.error}>{assignError}</span>}
      </form>
    </div>
  );
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
    width: 160,
  },
  inputSm: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 14,
    width: 100,
  },
  inputXs: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 14,
    width: 70,
  },
  select: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 14,
    width: 200,
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
  btnCancel: {
    padding: '6px 14px',
    background: '#e5e7eb',
    color: '#374151',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnEdit: {
    padding: '4px 10px',
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 13,
    cursor: 'pointer',
    color: '#374151',
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
  badgeActive: {
    padding: '2px 8px',
    background: '#dcfce7',
    color: '#166534',
    border: 'none',
    borderRadius: 12,
    fontSize: 12,
    cursor: 'pointer',
  },
  badgeInactive: {
    padding: '2px 8px',
    background: '#fee2e2',
    color: '#991b1b',
    border: 'none',
    borderRadius: 12,
    fontSize: 12,
    cursor: 'pointer',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
  },
};
