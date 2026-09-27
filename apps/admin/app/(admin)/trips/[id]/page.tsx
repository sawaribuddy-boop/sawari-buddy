import { createClient } from '@/lib/supabase/server';
import { formatRupees } from '@sawari/domain';
import { notFound } from 'next/navigation';
import { TripActions, CancelBookingButton } from './TripActions';

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from('trips')
    .select(`
      *,
      driver:profiles!trips_driver_id_fkey(full_name, email),
      auto:autos(registration_number),
      route:routes(
        fare_paise,
        origin:stops!routes_origin_stop_id_fkey(name),
        destination:stops!routes_destination_stop_id_fkey(name)
      )
    `)
    .eq('id', id)
    .single();

  if (!trip) notFound();

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, passenger:profiles!bookings_passenger_id_fkey(full_name, email)')
    .eq('trip_id', id)
    .order('created_at');

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 24 }}>Trip Detail</h1>
      <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 24px' }}>ID: {trip.id}</p>

      <div style={styles.grid}>
        <InfoCard label="Route" value={`${trip.route?.origin?.name ?? '?'} → ${trip.route?.destination?.name ?? '?'}`} />
        <InfoCard label="Driver" value={driverName(trip.driver)} />
        <InfoCard label="Auto" value={trip.auto?.registration_number ?? '—'} />
        <InfoCard label="Fare" value={trip.route ? formatRupees(trip.route.fare_paise) : '—'} />
        <InfoCard label="Status" value={trip.status} />
        <InfoCard label="Created" value={new Date(trip.created_at).toLocaleString()} />
      </div>

      <TripActions tripId={trip.id} tripStatus={trip.status} />

      <h2 style={{ fontSize: 18, margin: '32px 0 16px' }}>Bookings ({bookings?.length ?? 0})</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Passenger</th>
            <th style={styles.th}>Source</th>
            <th style={styles.th}>Seats</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(bookings ?? []).map((b) => (
            <tr key={b.id}>
              <td style={styles.td}>{b.passenger?.full_name ?? b.passenger?.email ?? b.passenger_id ?? 'Walk-in'}</td>
              <td style={styles.td}>{b.source}</td>
              <td style={styles.td}>{b.seat_count}</td>
              <td style={styles.td}>
                <span style={bookingBadge(b.status)}>{b.status}</span>
              </td>
              <td style={styles.td}>
                {b.status === 'CONFIRMED' && (
                  <CancelBookingButton bookingId={b.id} tripId={trip.id} />
                )}
              </td>
            </tr>
          ))}
          {(!bookings || bookings.length === 0) && (
            <tr>
              <td colSpan={5} style={{ ...styles.td, color: '#9ca3af', textAlign: 'center' }}>
                No bookings.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function driverName(driver: { full_name: string; email: string | null } | { full_name: string; email: string | null }[] | null): string {
  if (!driver) return '—';
  const d = Array.isArray(driver) ? driver[0] : driver;
  return d?.full_name ?? d?.email ?? '—';
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.card}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{value}</span>
    </div>
  );
}

function bookingBadge(status: string): React.CSSProperties {
  const base: React.CSSProperties = { padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500 };
  switch (status) {
    case 'CONFIRMED': return { ...base, background: '#dbeafe', color: '#1e40af' };
    case 'BOARDED': return { ...base, background: '#dcfce7', color: '#166534' };
    case 'COMPLETED': return { ...base, background: '#f3f4f6', color: '#374151' };
    case 'CANCELLED': return { ...base, background: '#fee2e2', color: '#991b1b' };
    case 'NO_SHOW': return { ...base, background: '#fef3c7', color: '#92400e' };
    default: return base;
  }
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    padding: 16,
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
  },
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
