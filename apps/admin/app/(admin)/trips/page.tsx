import { createClient } from '@/lib/supabase/server';
import { formatRupees } from '@sawari/domain';
import Link from 'next/link';

export default async function TripsPage() {
  const supabase = await createClient();

  const { data: trips } = await supabase
    .from('trips')
    .select(`
      *,
      driver:profiles!trips_driver_id_fkey(full_name),
      auto:autos(registration_number),
      route:routes(
        fare_paise,
        origin:stops!routes_origin_stop_id_fkey(name),
        destination:stops!routes_destination_stop_id_fkey(name)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24 }}>Trips</h1>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Route</th>
            <th style={styles.th}>Driver</th>
            <th style={styles.th}>Auto</th>
            <th style={styles.th}>Fare</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Created</th>
            <th style={styles.th}>Details</th>
          </tr>
        </thead>
        <tbody>
          {(trips ?? []).map((trip) => (
            <tr key={trip.id}>
              <td style={styles.td}>
                {trip.route?.origin?.name ?? '?'} &rarr; {trip.route?.destination?.name ?? '?'}
              </td>
              <td style={styles.td}>{driverName(trip.driver)}</td>
              <td style={styles.td}>{trip.auto?.registration_number ?? '—'}</td>
              <td style={styles.td}>{trip.route ? formatRupees(trip.route.fare_paise) : '—'}</td>
              <td style={styles.td}>
                <span style={statusBadge(trip.status)}>{trip.status}</span>
              </td>
              <td style={styles.td}>{new Date(trip.created_at).toLocaleDateString()}</td>
              <td style={styles.td}>
                <Link href={`/trips/${trip.id}`} style={styles.link}>View</Link>
              </td>
            </tr>
          ))}
          {(!trips || trips.length === 0) && (
            <tr>
              <td colSpan={7} style={{ ...styles.td, color: '#9ca3af', textAlign: 'center' }}>
                No trips yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function driverName(driver: { full_name: string } | { full_name: string }[] | null): string {
  if (!driver) return '—';
  const d = Array.isArray(driver) ? driver[0] : driver;
  return d?.full_name ?? '—';
}

function statusBadge(status: string): React.CSSProperties {
  const base: React.CSSProperties = { padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500 };
  switch (status) {
    case 'OPEN': return { ...base, background: '#dbeafe', color: '#1e40af' };
    case 'BOARDING': return { ...base, background: '#fef3c7', color: '#92400e' };
    case 'IN_PROGRESS': return { ...base, background: '#dcfce7', color: '#166534' };
    case 'COMPLETED': return { ...base, background: '#f3f4f6', color: '#374151' };
    case 'CANCELLED': return { ...base, background: '#fee2e2', color: '#991b1b' };
    case 'SUSPENDED': return { ...base, background: '#fce7f3', color: '#9d174d' };
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
  link: {
    color: '#2563eb',
    textDecoration: 'none',
    fontSize: 13,
  },
};
