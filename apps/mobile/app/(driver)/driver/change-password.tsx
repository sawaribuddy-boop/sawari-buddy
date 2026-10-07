import { useRouter } from 'expo-router';

import { Screen } from '@/components';
import { ChangePasswordForm } from '@/features/profile';

export default function DriverChangePasswordScreen() {
  const router = useRouter();
  return (
    <Screen scroll keyboardAvoiding edges={['bottom']}>
      <ChangePasswordForm onDone={() => router.back()} />
    </Screen>
  );
}
