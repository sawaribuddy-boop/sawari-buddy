'use client';

import { adminCancelBooking, adminCancelTrip, adminResumeTrip } from '../actions';

export function TripActions({ tripId, tripStatus }: { tripId: string; tripStatus: string }) {
  const canCancel = ['OPEN', 'BOARDING'].includes(tripStatus);
  const canResume = tripStatus === 'SUSPENDED';

  if (!canCancel && !canResume) return null;

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {canCancel && (
        <form action={async () => { await adminCancelTrip(tripId); }}>
          <button type="submit" style={styles.btnDanger}>Cancel Trip</button>
        </form>
      )}
      {canResume && (
        <form action={async () => { await adminResumeTrip(tripId); }}>
          <button type="submit" style={styles.btnAction}>Resume Trip</button>
        </form>
      )}
    </div>
  );
}

export function CancelBookingButton({ bookingId, tripId }: { bookingId: string; tripId: string }) {
  return (
    <form action={async () => { await adminCancelBooking(bookingId, tripId); }}>
      <button type="submit" style={styles.btnSmDanger}>Cancel</button>
    </form>
  );
}

const styles = {
  btnDanger: {
    padding: '6px 14px',
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnAction: {
    padding: '6px 14px',
    background: '#1a7a3a',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnSmDanger: {
    padding: '3px 8px',
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
};
