'use client';

import { useActionState, useState } from 'react';
import { createRoute, updateRoute, toggleRouteActive } from './actions';

interface RouteRow {
  id: string;
  origin_stop_id: string;
  destination_stop_id: string;
  fare_paise: number;
  display_order: number;
  is_active: boolean;
  approx_distance_m: number | null;
  origin: { name: string } | null;
  destination: { name: string } | null;
}

interface StopOption {
  id: string;
  name: string;
}

export function RoutesTable({
  routes,
  stops,
  formatRupees,
}: {
  routes: RouteRow[];
  stops: StopOption[];
  formatRupees: (paise: number) => string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createError, createAction, createPending] = useActionState(createRoute, null);
  const [updateError, updateAction, updatePending] = useActionState(updateRoute, null);

  return (
    <div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Origin</th>
            <th style={styles.th}>Destination</th>
            <th style={styles.th}>Fare</th>
            <th style={styles.th}>Order</th>
            <th style={styles.th}>Active</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route) =>
            editingId === route.id ? (
              <tr key={route.id}>
                <td colSpan={6} style={styles.td}>
                  <form action={updateAction} style={styles.inlineForm}>
                    <input type="hidden" name="id" value={route.id} />
                    <span style={styles.readOnly}>{route.origin?.name} &rarr; {route.destination?.name}</span>
                    <input name="fare_rupees" type="number" step="0.01" defaultValue={route.fare_paise / 100} style={styles.inputSm} required />
                    <input name="display_order" type="number" defaultValue={route.display_order} style={styles.inputSm} required />
                    <button type="submit" disabled={updatePending} style={styles.btnSave}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)} style={styles.btnCancel}>Cancel</button>
                    {updateError && <span style={styles.error}>{updateError}</span>}
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={route.id}>
                <td style={styles.td}>{route.origin?.name ?? route.origin_stop_id}</td>
                <td style={styles.td}>{route.destination?.name ?? route.destination_stop_id}</td>
                <td style={styles.td}>{formatRupees(route.fare_paise)}</td>
                <td style={styles.td}>{route.display_order}</td>
                <td style={styles.td}>
                  <form action={() => toggleRouteActive(route.id, route.is_active)}>
                    <button type="submit" style={route.is_active ? styles.badgeActive : styles.badgeInactive}>
                      {route.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </form>
                </td>
                <td style={styles.td}>
                  <button onClick={() => setEditingId(route.id)} style={styles.btnEdit}>Edit</button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      <h3 style={{ margin: '24px 0 12px', fontSize: 16 }}>Add Route</h3>
      <form action={createAction} style={styles.inlineForm}>
        <select name="origin_stop_id" style={styles.select} required>
          <option value="">Origin stop</option>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select name="destination_stop_id" style={styles.select} required>
          <option value="">Destination stop</option>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input name="fare_rupees" type="number" step="0.01" placeholder="Fare (₹)" style={styles.inputSm} required />
        <input name="display_order" type="number" placeholder="Order" defaultValue={0} style={styles.inputSm} required />
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
  readOnly: {
    fontSize: 14,
    color: '#6b7280',
    marginRight: 8,
  },
  select: {
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
