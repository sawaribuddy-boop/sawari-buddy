import { Screen } from '@/components';
import { ProfileView } from '@/features/auth/ProfileView';

export default function DriverProfileScreen() {
  return (
    <Screen edges={['bottom']}>
      <ProfileView />
    </Screen>
  );
}
