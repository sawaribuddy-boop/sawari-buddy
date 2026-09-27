'use client';

import { useActionState } from 'react';
import { recordSettlement, recordAdjustment } from './actions';

interface DriverOption {
  id: string;
  profile: { full_name: string | null; email: string | null } | null;
}

export function LedgerForms({ drivers }: { drivers: DriverOption[] }) {
  const [settlementError, settlementAction, settlementPending] = useActionState(recordSettlement, null);
  const [adjustmentError, adjustmentAction, adjustmentPending] = useActionState(recordAdjustment, null);

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={styles.sectionTitle}>Record Settlement</h2>
      <form action={settlementAction} style={styles.form}>
        <select name="driver_id" style={styles.select} required>
          <option value="">Select driver</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.profile?.full_name ?? d.profile?.email ?? d.id}</option>
          ))}
        </select>
        <input name="amount_rupees" type="number" step="0.01" placeholder="Amount (₹)" style={styles.input} required />
        <input name="description" placeholder="Description (optional)" style={styles.inputWide} />
        <button type="submit" disabled={settlementPending} style={styles.btnSave}>
          {settlementPending ? 'Recording…' : 'Record Settlement'}
        </button>
        {settlementError && <span style={styles.error}>{settlementError}</span>}
      </form>

      <h2 style={{ ...styles.sectionTitle, marginTop: 24 }}>Record Adjustment</h2>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px' }}>
        Positive = credit to driver, negative = debit from driver.
      </p>
      <form action={adjustmentAction} style={styles.form}>
        <select name="driver_id" style={styles.select} required>
          <option value="">Select driver</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.profile?.full_name ?? d.profile?.email ?? d.id}</option>
          ))}
        </select>
        <input name="amount_rupees" type="number" step="0.01" placeholder="Amount (₹)" style={styles.input} required />
        <input name="description" placeholder="Description (required)" style={styles.inputWide} required />
        <button type="submit" disabled={adjustmentPending} style={styles.btnSave}>
          {adjustmentPending ? 'Recording…' : 'Record Adjustment'}
        </button>
        {adjustmentError && <span style={styles.error}>{adjustmentError}</span>}
      </form>
    </div>
  );
}

const styles = {
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: '0 0 12px',
  } as React.CSSProperties,
  form: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  select: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 14,
    width: 200,
  },
  input: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 14,
    width: 120,
  },
  inputWide: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 14,
    width: 220,
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
  error: {
    color: '#dc2626',
    fontSize: 13,
  },
};
