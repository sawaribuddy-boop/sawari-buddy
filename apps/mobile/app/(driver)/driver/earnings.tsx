import { formatRupees } from '@sawari/domain';
import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Screen } from '@/components';
import { useDriverEarnings } from '@/features/driver';
import { colors, spacing } from '@/theme';

export default function EarningsScreen() {
  const router = useRouter();
  const { data: rawEarnings, isLoading, refetch } = useDriverEarnings();
  const earnings = rawEarnings as Record<string, unknown> | null;

  const totalFare = (earnings?.total_fare_paise ?? 0) as number;
  const platformFee = (earnings?.total_platform_fee_paise ?? 0) as number;
  const netEarnings = (earnings?.net_earnings_paise ?? 0) as number;
  const tripCount = (earnings?.trip_count ?? 0) as number;

  return (
    <Screen
      scroll
      edges={['top']}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refetch()} />}
    >
      <View style={styles.body}>
        <Button label="Back" variant="ghost" icon="arrow-left" fullWidth={false} size="md" onPress={() => router.back()} />
        <AppText variant="title">Earnings</AppText>
        <AppText variant="small" color={colors.ink500}>
          Today's summary
        </AppText>

        <Card>
          <View style={styles.mainAmount}>
            <AppText variant="small" color={colors.ink500}>
              Net Earnings
            </AppText>
            <AppText variant="display" color={colors.green700}>
              {formatRupees(netEarnings)}
            </AppText>
          </View>
        </Card>

        <Card>
          <View style={styles.detailRow}>
            <AppText variant="body" color={colors.ink500}>
              Trips completed
            </AppText>
            <AppText variant="bodyStrong">{tripCount}</AppText>
          </View>
          <View style={styles.detailRow}>
            <AppText variant="body" color={colors.ink500}>
              Total fares collected
            </AppText>
            <AppText variant="bodyStrong">{formatRupees(totalFare)}</AppText>
          </View>
          <View style={styles.detailRow}>
            <AppText variant="body" color={colors.ink500}>
              Platform fee
            </AppText>
            <AppText variant="bodyStrong" color={colors.danger}>
              -{formatRupees(platformFee)}
            </AppText>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  mainAmount: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
