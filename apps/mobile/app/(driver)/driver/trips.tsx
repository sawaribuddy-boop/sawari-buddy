import { Screen } from '@/components';
import { DriverTripHistoryList } from '@/features/profile';

export default function DriverTripsScreen() {
  return (
    <Screen padded={false} edges={['bottom']}>
      <DriverTripHistoryList />
    </Screen>
  );
}
