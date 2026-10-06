import { StyleSheet, View } from 'react-native';

import { AppText, Screen } from '@/components';
import { ProfileView, type ProfileViewProps } from '@/features/profile';
import { spacing } from '@/theme';

const LINKS: ProfileViewProps['links'] = {
  editProfile: '/(passenger)/edit-profile',
  changePassword: '/(passenger)/change-password',
  reportProblem: '/(passenger)/report-problem',
  rides: [
    {
      title: 'My bookings',
      subtitle: 'Your rides, past and upcoming',
      icon: 'ticket-confirmation-outline',
      href: '/(passenger)/bookings',
    },
  ],
};

export default function PassengerProfileScreen() {
  return (
    <Screen scroll edges={['top']}>
      <View style={styles.body}>
        <AppText variant="title">Profile</AppText>
        <ProfileView links={LINKS} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
});
