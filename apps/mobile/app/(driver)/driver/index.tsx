import { firstName, greeting } from '@sawari/domain';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Card, Icon, ListRow, Screen, StatusPill } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, radius, spacing } from '@/theme';

const DRIVER_STATUS_NOTICE = {
  PENDING_VERIFICATION: {
    title: 'Verification pending',
    message: 'Your driver account is being verified. You can go online once SawariBuddy approves it.',
  },
  SUSPENDED: {
    title: 'Driver account suspended',
    message: 'You cannot go online. Please contact SawariBuddy support.',
  },
} as const;

// Driver home (concept D1). Going online, trips, walk-ins and earnings are built in Phase 2 Steps 5 and 7.
export default function DriverHomeScreen() {
  const { account } = useAuth();
  if (!account) return null;
  const restriction = account.driverStatus && account.driverStatus !== 'ACTIVE' ? DRIVER_STATUS_NOTICE[account.driverStatus] : null;

  return (
    <Screen edges={['top']}>
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Icon name="account" size={28} color={colors.green700} />
          </View>
          <View style={styles.flex}>
            <AppText variant="small" color={colors.ink500}>
              {greeting()},
            </AppText>
            <AppText variant="heading">{firstName(account.fullName)}</AppText>
          </View>
          <StatusPill label="Offline" tone="danger" />
        </View>

        {restriction ? <Banner tone="danger" title={restriction.title} message={restriction.message} /> : null}
        <Banner tone="info" title="Trips are coming next" message="Going online, managing passengers and earnings arrive in later steps of Phase 2." />

        <Card padded={false} style={styles.listCard}>
          <ListRow icon="account-circle-outline" title="Profile" subtitle="Account and sign out" onPress={() => router.push('/driver/profile')} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  listCard: { paddingHorizontal: spacing.md },
});
