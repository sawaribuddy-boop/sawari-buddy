import { useRouter } from 'expo-router';

import { Screen } from '@/components';
import { ReportProblemForm } from '@/features/profile';

export default function DriverReportProblemScreen() {
  const router = useRouter();
  return (
    <Screen scroll keyboardAvoiding edges={['bottom']}>
      <ReportProblemForm onDone={() => router.back()} />
    </Screen>
  );
}
