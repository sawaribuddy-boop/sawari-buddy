import { Screen } from '@/components';
import { ProfileView, type ProfileViewProps } from '@/features/profile';

const LINKS: ProfileViewProps['links'] = {
  editProfile: '/driver/edit-profile',
  changePassword: '/driver/change-password',
  reportProblem: '/driver/report-problem',
  rides: [
    { title: 'Trip history', subtitle: 'Completed and cancelled trips', icon: 'history', href: '/driver/trips' },
    { title: 'Earnings', subtitle: 'Totals by day, week or month', icon: 'cash-multiple', href: '/driver/earnings' },
  ],
};

export default function DriverProfileScreen() {
  return (
    <Screen scroll edges={['bottom']}>
      <ProfileView links={LINKS} />
    </Screen>
  );
}
