import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: driverCount },
    { count: passengerCount },
    { count: tripCount },
    { count: issueCount },
  ] = await Promise.all([
    supabase.from('drivers').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'PASSENGER'),
    supabase.from('trips').select('*', { count: 'exact', head: true }),
    supabase.from('issues').select('*', { count: 'exact', head: true }).eq('status', 'OPEN'),
  ]);

  const cards = [
    { label: 'Drivers', value: driverCount ?? 0 },
    { label: 'Passengers', value: passengerCount ?? 0 },
    { label: 'Trips', value: tripCount ?? 0 },
    { label: 'Open issues', value: issueCount ?? 0 },
  ];

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24 }}>Dashboard</h1>
      <div style={styles.grid}>
        {cards.map(({ label, value }) => (
          <div key={label} style={styles.card}>
            <span style={styles.cardValue}>{value}</span>
            <span style={styles.cardLabel}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 16,
  },
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: 20,
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
  },
  cardValue: {
    fontSize: 32,
    fontWeight: 700,
    color: '#111827',
  },
  cardLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
};
