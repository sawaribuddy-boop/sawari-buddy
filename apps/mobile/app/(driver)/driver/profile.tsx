import { StyleSheet, View } from 'react-native';

import { Card, LanguagePicker, Screen } from '@/components';
import { ProfileView } from '@/features/auth/ProfileView';
import { spacing } from '@/theme';

export default function DriverProfileScreen() {
  return (
    <Screen scroll edges={['bottom']}>
      <View style={styles.body}>
        <ProfileView />
        <Card>
          <LanguagePicker />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
});
