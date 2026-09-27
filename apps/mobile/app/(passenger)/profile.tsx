import { StyleSheet, View } from 'react-native';

import { AppText, Screen } from '@/components';
import { ProfileView } from '@/features/auth/ProfileView';
import { spacing } from '@/theme';

export default function PassengerProfileScreen() {
  return (
    <Screen edges={['top']}>
      <View style={styles.body}>
        <AppText variant="title">Profile</AppText>
        <ProfileView />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
});
