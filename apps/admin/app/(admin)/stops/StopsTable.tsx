'use client';

import type { Stop } from '@sawari/types';
import { useActionState, useState } from 'react';
import { createStop, updateStop, toggleStopActive } from './actions';

export function StopsTable({ stops }: { stops: Stop[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createError, createAction, createPending] = useActionState(createStop, null);
  const [updateError, updateAction, updatePending] = useActionState(updateStop, null);

  return (
    <div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Lat</th>
            <th style={styles.th}>Lng</th>
            <th style={styles.th}>Active</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {stops.map((stop) =>
            editingId === stop.id ? (
              <tr key={stop.id}>
                <td colSpan={5} style={styles.td}>
                  <form action={updateAction} style={styles.inlineForm}>
                    <input type="hidden" name="id" value={stop.id} />
                    <input name="name" defaultValue={stop.name} style={styles.input} required />
                    <input name="lat" type="number" step="any" defaultValue={stop.lat} style={styles.inputSm} required />
                    <input name="lng" type="number" step="any" defaultValue={stop.lng} style={styles.inputSm} required />
                    <button type="submit" disabled={updatePending} style={styles.btnSave}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)} style={styles.btnCancel}>Cancel</button>
                    {updateError && <span style={styles.error}>{updateError}</span>}
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={stop.id}>
                <td style={styles.td}>{stop.name}</td>
                <td style={styles.td}>{stop.lat}</td>
                <td style={styles.td}>{stop.lng}</td>
                <td style={styles.td}>
                  <form action={() => toggleStopActive(stop.id, stop.is_active)}>
                    <button type="submit" style={stop.is_active ? styles.badgeActive : styles.badgeInactive}>
                      {stop.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </form>
                </td>
                <td style={styles.td}>
                  <button onClick={() => setEditingId(stop.id)} style={styles.btnEdit}>Edit</button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      <h3 style={{ margin: '24px 0 12px', fontSize: 16 }}>Add Stop</h3>
      <form action={createAction} style={styles.inlineForm}>
        <input name="name" placeholder="Stop name" style={styles.input} required />
        <input name="lat" type="number" step="any" placeholder="Latitude" style={styles.inputSm} required />
        <input name="lng" type="number" step="any" placeholder="Longitude" style={styles.inputSm} required />
        <button type="submit" disabled={createPending} style={styles.btnSave}>
          {createPending ? 'Adding…' : 'Add'}
        </button>
        {createError && <span style={styles.error}>{createError}</span>}
      </form>
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
  inputSm: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 14,
    width: 100,
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
