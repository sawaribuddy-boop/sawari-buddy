import { formatRupees } from '@sawari/domain';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, type EarningsPeriod, PERIOD_LABELS, PeriodPicker, Screen } from '@/components';
import { useDriverEarnings } from '@/features/driver';
import { colors, spacing } from '@/theme';

export default function EarningsScreen() {
  const router = useRouter();
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [period, setPeriod] = useState<EarningsPeriod>('today');

  const { data: rawEarnings, isLoading, refetch } = useDriverEarnings(range);
  const earnings = rawEarnings as Record<string, unknown> | null;

  const totalFare = (earnings?.fares_collected_paise ?? 0) as number;
  const platformFee = ((earnings?.fares_collected_paise ?? 0) as number) - ((earnings?.earnings_paise ?? 0) as number);
  const netEarnings = (earnings?.earnings_paise ?? 0) as number;
  const tripCount = (earnings?.completed_trips ?? 0) as number;

  return (
    <Screen
      scroll
      edges={['top']}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refetch()} />}
    >
      <View style={styles.body}>
        <Button label="Back" variant="ghost" icon="arrow-left" fullWidth={false} size="md" onPress={() => router.back()} />
        <AppText variant="title">Earnings</AppText>
        <PeriodPicker
          onChange={(r, key) => {
            setRange(r);
            setPeriod(key);
          }}
        />
        <AppText variant="small" color={colors.ink500}>
          {PERIOD_LABELS[period]}
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
