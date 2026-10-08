import { errorMessageFor, PAYMENT_STATUS } from '@sawari/constants';
import { formatRupees } from '@sawari/domain';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Card, Icon, Screen, StatusPill } from '@/components';
import { type PaymentToCollect, useDriverPaymentsToCollect, useMarkBookingPayment } from '@/features/driver';
import { colors, spacing } from '@/theme';

function passengerName(b: PaymentToCollect): string {
  if (b.source === 'WALK_IN') return b.walk_in_label ? `${b.walk_in_label} (walk-in)` : 'Walk-in passenger';
  return b.passenger_first_name || 'Passenger';
}

function seats(n: number) {
  return `${n} ${n === 1 ? 'seat' : 'seats'}`;
}

/**
 * Shown right after "End trip": the driver confirms, for each passenger, whether the cash fare was
 * received. Received posts the fare to earnings; Not paid charges no platform fee. A new trip cannot
 * start until every passenger is marked.
 */
export default function CollectPaymentScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useDriverPaymentsToCollect();
  const markMutation = useMarkBookingPayment();

  const bookings = data?.bookings ?? [];
  const pending = bookings.filter((b) => b.payment_status === PAYMENT_STATUS.PENDING);
  const toCollectPaise = pending.reduce((sum, b) => sum + b.total_fare_paise, 0);
  const trips = [...new Map(bookings.map((b) => [b.trip_id, b])).values()];
  const busyId = markMutation.isPending ? markMutation.variables?.bookingId : undefined;

  function markReceived(b: PaymentToCollect) {
    markMutation.mutate({ bookingId: b.id, received: true });
  }

  function confirmNotPaid(b: PaymentToCollect) {
    Alert.alert(
      `${passengerName(b)} did not pay?`,
      `${formatRupees(b.total_fare_paise)} will be recorded as not paid and no platform fee is charged for it. ` +
        'If they pay later, you can still mark it as received.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Not paid', style: 'destructive', onPress: () => markMutation.mutate({ bookingId: b.id, received: false }) },
      ],
    );
  }

  if (isLoading) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.green600} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      edges={['bottom']}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.green600} />}
      footer={
        <Button
          label={pending.length > 0 ? `Mark ${pending.length} more to finish` : 'Done'}
          icon={pending.length > 0 ? undefined : 'check'}
          disabled={pending.length > 0}
          onPress={() => router.replace('/driver')}
        />
      }
    >
      <View style={styles.body}>
        <View style={styles.summary}>
          <AppText variant="small" color={colors.ink500}>
            {pending.length > 0 ? 'Collect in cash' : 'All payments recorded'}
          </AppText>
          <AppText variant="display" color={pending.length > 0 ? colors.ink900 : colors.green700}>
            {formatRupees(toCollectPaise)}
          </AppText>
          {pending.length > 0 ? (
            <AppText variant="small" color={colors.ink500}>
              Mark each passenger once they have paid. You can start your next trip after that.
            </AppText>
          ) : null}
        </View>

        {isError ? <Banner tone="danger" title="Could not load payments" message="Pull down to retry." /> : null}
        {markMutation.isError ? <Banner tone="danger" title={errorMessageFor(markMutation.error)} /> : null}

        {bookings.length === 0 && !isError ? (
          <AppText variant="body" color={colors.ink500} align="center">
            No passengers to collect from.
          </AppText>
        ) : null}

        {trips.map((t) => (
          <View key={t.trip_id} style={styles.trip}>
            <View style={styles.route}>
              <AppText variant="bodyStrong">{t.origin}</AppText>
              <Icon name="arrow-right" color={colors.ink400} size={14} />
              <AppText variant="bodyStrong">{t.destination}</AppText>
            </View>
            {bookings
              .filter((b) => b.trip_id === t.trip_id)
              .map((b) => (
                <Card key={b.id}>
                  <View style={styles.row}>
                    <View style={styles.rowTop}>
                      <View style={styles.flex}>
                        <AppText variant="bodyStrong">{passengerName(b)}</AppText>
                        <AppText variant="small" color={colors.ink500}>
                          #{b.code} · {seats(b.seat_count)}
                        </AppText>
                      </View>
                      <AppText variant="heading">{formatRupees(b.total_fare_paise)}</AppText>
                    </View>

                    {b.payment_status === PAYMENT_STATUS.PAID ? (
                      <StatusPill label="Cash received" tone="success" />
                    ) : (
                      <View style={styles.actions}>
                        {b.payment_status === PAYMENT_STATUS.UNPAID ? <StatusPill label="Not paid" tone="danger" /> : null}
                        <Button
                          label={b.payment_status === PAYMENT_STATUS.UNPAID ? 'Paid now' : 'Received cash'}
                          icon="cash-check"
                          size="md"
                          loading={busyId === b.id && markMutation.variables?.received === true}
                          disabled={markMutation.isPending}
                          onPress={() => markReceived(b)}
                        />
                        {b.payment_status === PAYMENT_STATUS.PENDING ? (
                          <Button
                            label="Not paid"
                            variant="dangerSoft"
                            size="md"
                            loading={busyId === b.id && markMutation.variables?.received === false}
                            disabled={markMutation.isPending}
                            onPress={() => confirmNotPaid(b)}
                          />
                        ) : null}
                      </View>
                    )}
                  </View>
                </Card>
              ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { gap: spacing.lg },
  summary: { gap: spacing.xs, alignItems: 'center', paddingVertical: spacing.md },
  trip: { gap: spacing.sm },
  route: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  row: { gap: spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs },
  actions: { gap: spacing.sm },
});
