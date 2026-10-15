import { useRouter } from 'expo-router';

import { Screen } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { VerifyPhoneForm } from '@/features/auth/VerifyPhoneForm';

export default function DriverChangePhoneScreen() {
  const router = useRouter();
  const { account } = useAuth();
  return (
    <Screen scroll keyboardAvoiding edges={['bottom']}>
      <VerifyPhoneForm initialPhone={account?.phoneVerified ? null : account?.phone} onVerified={() => router.back()} />
    </Screen>
  );
}
