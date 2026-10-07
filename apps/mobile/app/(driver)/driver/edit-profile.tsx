import { useRouter } from 'expo-router';

import { Screen } from '@/components';
import { EditProfileForm } from '@/features/profile';

export default function DriverEditProfileScreen() {
  const router = useRouter();
  return (
    <Screen scroll keyboardAvoiding edges={['bottom']}>
      <EditProfileForm onDone={() => router.back()} />
    </Screen>
  );
}
