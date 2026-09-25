// Phase 1 skeleton only. Admin screens (auth guard, fleet, routes, trips, ledger, issues) arrive in Phase 5.
import { TRIP_STATUS } from '@sawari/constants';
import { splitFare, formatRupees } from '@sawari/domain';

export default function HomePage() {
  const example = splitFare(4000, 1000);
  return (
    <main style={{ padding: 32 }}>
      <h1>SawariBuddy Admin</h1>
      <p>Development skeleton — no screens yet.</p>
      <p style={{ color: '#6b7280', fontSize: 14 }}>
        Shared packages linked: {formatRupees(4000)} fare → {formatRupees(example.platformFeePaise)} fee /{' '}
        {formatRupees(example.driverEarningPaise)} driver · trip states: {Object.keys(TRIP_STATUS).length}
      </p>
    </main>
  );
}
