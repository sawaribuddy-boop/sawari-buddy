'use client';

import { useActionState } from 'react';
import { updateSettings } from './actions';

interface Settings {
  commission_bps: number;
  walk_in_commission_bps: number;
  max_seats_per_booking: number;
  no_show_grace_seconds: number;
  driver_stale_seconds: number;
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const [error, formAction, pending] = useActionState(updateSettings, null);

  return (
    <form action={formAction} style={styles.form}>
      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.grid}>
        <Field label="Commission (bps)" name="commission_bps" defaultValue={settings.commission_bps} hint="1000 = 10%" />
        <Field label="Walk-in commission (bps)" name="walk_in_commission_bps" defaultValue={settings.walk_in_commission_bps} hint="0 = no commission" />
        <Field label="Max seats per booking" name="max_seats_per_booking" defaultValue={settings.max_seats_per_booking} hint="1-8" />
        <Field label="No-show grace (seconds)" name="no_show_grace_seconds" defaultValue={settings.no_show_grace_seconds} hint="e.g. 300 = 5 min" />
        <Field label="Driver stale (seconds)" name="driver_stale_seconds" defaultValue={settings.driver_stale_seconds} hint="Heartbeat timeout" />
      </div>

      <button type="submit" disabled={pending} style={styles.btn}>
        {pending ? 'Saving…' : 'Save Settings'}
      </button>
    </form>
  );
}

function Field({ label, name, defaultValue, hint }: { label: string; name: string; defaultValue: number; hint: string }) {
  return (
    <label style={styles.label}>
      <span>{label}</span>
      <input name={name} type="number" defaultValue={defaultValue} style={styles.input} required />
      <span style={styles.hint}>{hint}</span>
    </label>
  );
}

const styles = {
  form: {
    background: '#fff',
    padding: 24,
    borderRadius: 8,
    border: '1px solid #e5e7eb',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
    marginBottom: 20,
  },
  label: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    fontSize: 14,
    fontWeight: 500,
    color: '#374151',
  },
  input: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 14,
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: 400,
  },
  btn: {
    padding: '8px 20px',
    background: '#1a7a3a',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    margin: '0 0 12px',
    padding: '8px 12px',
    background: '#fef2f2',
    color: '#dc2626',
    borderRadius: 6,
    fontSize: 14,
  },
};
