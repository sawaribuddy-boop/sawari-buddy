import { firstName } from '@sawari/domain';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Screen } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, spacing } from '@/theme';

// Passenger home. The booking flow (concept P2–P5) is built in Phase 2 Step 6.
export default function BookScreen() {
  const { account } = useAuth();
  return (
    <Screen edges={['top']}>
      <View style={styles.body}>
        <AppText variant="small" color={colors.ink500}>
          Hi {account ? firstName(account.fullName) : 'there'}
        </AppText>
        <AppText variant="title">Where are you going?</AppText>
        <Banner tone="info" title="Booking is coming next" message="Searching for autos and booking seats arrive in a later step of Phase 2." />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
});
