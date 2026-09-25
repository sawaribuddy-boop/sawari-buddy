import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Screen } from '@/components';
import { spacing } from '@/theme';

// Booking history is built in Phase 2 Step 6.
export default function BookingsScreen() {
  return (
    <Screen edges={['top']}>
      <View style={styles.body}>
        <AppText variant="title">My bookings</AppText>
        <Banner tone="info" title="Nothing here yet" message="Your bookings will appear here once booking is available." />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
});
