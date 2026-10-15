import { BOOKING_STATUS, errorMessageFor, isErrorCode, PAYMENT_STATUS, type PaymentStatus } from '@sawari/constants';
import { formatClockTime, formatRupees } from '@sawari/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';

import { useKeepAwake } from 'expo-keep-awake';

import { AppText, Banner, Button, Card, Icon, OfflineBanner, Screen, SeatBar, StatusPill } from '@/components';
import { useCompleteTrip, useDriverHome, useDropOffPassenger } from '@/features/driver';
import { colors, spacing } from '@/theme';

type Booking = {
  id: string;
  code: string;
  source: string;
  status: string;
  seat_count: number;
  passenger_first_name: string | null;
  walk_in_label: string | null;
  total_fare_paise: number;
  payment_status: PaymentStatus | null;
  completed_at: string | null;
};

function passengerName(b: Booking): string {
  if (b.source === 'WALK_IN') return b.walk_in_label || 'Walk-in';
  return b.passenger_first_name || 'Passenger';
}

function seats(n: number) {
  return `${n} ${n === 1 ? 'seat' : 'seats'}`;
}

function errorText(error: Error) {
  return isErrorCode(error.message) ? errorMessageFor(error) : error.message;
}

/**
 * The driver drops off each passenger where they get off, recording whether they paid the cash
 * fare. "End trip" appears once nobody is left on board.
 */
export default function TripInProgressScreen() {
  useKeepAwake();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  const { data: rawHome, refetch } = useDriverHome();
  const completeTripMutation = useCompleteTrip();
  const dropOffMutation = useDropOffPassenger();

  const home = rawHome as Record<string, unknown> | null;
  const activeTrip = home?.active_trip as Record<string, unknown> | null;
  const trip = activeTrip?.trip as Record<string, unknown> | null;
  const route = activeTrip?.route as { origin: string; destination: string } | null;
  const bookings = (activeTrip?.bookings ?? []) as Booking[];
  const status = trip?.status as string | undefined;
  const capacity = (trip?.capacity ?? 0) as number;
  const occupiedSeats = (activeTrip?.occupied_seats ?? 0) as number;
  const startedAt = trip?.started_at as string | null | undefined;

  const handleComplete = useCallback(() => {
    if (!tripId) return;
    completeTripMutation.mutate(tripId, { onSuccess: () => router.replace('/driver') });
  }, [tripId, completeTripMutation, router]);

  useEffect(() => {
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      router.back();
    }
  }, [status, router]);

  if (!trip) {
    return (
      <Screen edges={['top']}>
        <View style={styles.body}>
          <Button label="Back" variant="ghost" icon="arrow-left" fullWidth={false} size="md" onPress={() => router.back()} />
          <AppText variant="title">Loading...</AppText>
        </View>
      </Screen>
    );
  }

  const onBoard = bookings.filter((b) => b.status === BOOKING_STATUS.BOARDED);
  const droppedOff = bookings.filter((b) => b.status === BOOKING_STATUS.COMPLETED);
  const collectedPaise = droppedOff
    .filter((b) => b.payment_status === PAYMENT_STATUS.PAID)
    .reduce((sum, b) => sum + b.total_fare_paise, 0);
  const toCollectPaise = onBoard.reduce((sum, b) => sum + b.total_fare_paise, 0);
  const busy = dropOffMutation.isPending ? dropOffMutation.variables : undefined;

  function dropOff(b: Booking) {
    dropOffMutation.mutate({ bookingId: b.id, received: true });
  }

  function confirmNotPaid(b: Booking) {
    Alert.alert(
      `${passengerName(b)} did not pay?`,
      `${formatRupees(b.total_fare_paise)} will be recorded as not paid and no platform fee is charged for it. ` +
        'If they pay later, you can still mark it as received.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Not paid', style: 'destructive', onPress: () => dropOffMutation.mutate({ bookingId: b.id, received: false }) },
      ],
    );
  }

  return (
    <Screen
      scroll
      edges={['top']}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refetch()} />}
      footer={
        onBoard.length === 0 ? (
          <Button
            label="End trip"
            variant="primary"
            icon="check-circle"
            loading={completeTripMutation.isPending}
            onPress={handleComplete}
          />
        ) : (
          <AppText variant="small" color={colors.ink500} align="center">
            Drop off {onBoard.length === 1 ? 'the last passenger' : `all ${onBoard.length} passengers`} to end the trip.
          </AppText>
        )
      }
    >
      <View style={styles.body}>
        <Button label="Back" variant="ghost" icon="arrow-left" fullWidth={false} size="md" onPress={() => router.back()} />

        <OfflineBanner />

        <View style={styles.heroCard}>
          <Icon name="steering" color={colors.white} size={32} />
          <AppText variant="title" color={colors.white}>
            Trip In Progress
          </AppText>
          <AppText variant="body" color={colors.green100}>
            {route?.origin} → {route?.destination}
          </AppText>
          {startedAt ? (
            <AppText variant="small" color={colors.green100}>
              Started at {formatClockTime(startedAt)}
            </AppText>
          ) : null}
        </View>

        {completeTripMutation.isError ? (
          <Banner tone="danger" title="Could not end the trip" message={errorText(completeTripMutation.error)} />
        ) : null}
        {dropOffMutation.isError ? (
          <Banner tone="danger" title="Could not drop off" message={errorText(dropOffMutation.error)} />
        ) : null}

        <SeatBar occupied={occupiedSeats} capacity={capacity} />

        <Card>
          <View style={styles.fareRow}>
            <AppText variant="bodyStrong">Still to collect</AppText>
            <AppText variant="heading" color={colors.green700}>
              {formatRupees(toCollectPaise)}
            </AppText>
          </View>
          <AppText variant="small" color={colors.ink500}>
            Cash · {formatRupees(collectedPaise)} collected so far
          </AppText>
        </Card>

        {onBoard.length > 0 ? <AppText variant="heading">On board</AppText> : null}
        {onBoard.map((b) => (
          <Card key={b.id}>
            <View style={styles.card}>
              <View style={styles.bookingRow}>
                <View style={styles.codeBox}>
                  <AppText variant="bodyStrong">{b.code}</AppText>
                </View>
                <View style={styles.flex}>
                  <AppText variant="body">{passengerName(b)}</AppText>
                  <AppText variant="small" color={colors.ink500}>
                    {seats(b.seat_count)} · {formatRupees(b.total_fare_paise)}
                  </AppText>
                </View>
              </View>
              <View style={styles.actions}>
                <Button
                  label="Dropped off · cash received"
                  icon="cash-check"
                  size="md"
                  loading={busy?.bookingId === b.id && busy.received}
                  disabled={dropOffMutation.isPending}
                  onPress={() => dropOff(b)}
                />
                <Button
                  label="Dropped off · not paid"
                  variant="dangerSoft"
                  size="md"
                  loading={busy?.bookingId === b.id && !busy.received}
                  disabled={dropOffMutation.isPending}
                  onPress={() => confirmNotPaid(b)}
                />
              </View>
            </View>
          </Card>
        ))}

        {droppedOff.length > 0 ? <AppText variant="heading">Dropped off</AppText> : null}
        {droppedOff.map((b) => (
          <Card key={b.id}>
            <View style={styles.card}>
              <View style={styles.bookingRow}>
                <View style={styles.flex}>
                  <AppText variant="body">{passengerName(b)}</AppText>
                  <AppText variant="small" color={colors.ink500}>
                    #{b.code} · {seats(b.seat_count)} · {formatRupees(b.total_fare_paise)}
                  </AppText>
                  {b.completed_at ? (
                    <AppText variant="small" color={colors.ink500}>
                      Dropped off at {formatClockTime(b.completed_at)}
                    </AppText>
                  ) : null}
                </View>
                {b.payment_status === PAYMENT_STATUS.PAID ? (
                  <StatusPill label="Cash received" tone="success" />
                ) : (
                  <StatusPill label="Not paid" tone="danger" />
                )}
              </View>
              {b.payment_status === PAYMENT_STATUS.UNPAID ? (
                <Button
                  label="Paid now"
                  variant="secondary"
                  icon="cash-check"
                  size="md"
                  loading={busy?.bookingId === b.id}
                  disabled={dropOffMutation.isPending}
                  onPress={() => dropOff(b)}
                />
              ) : null}
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  heroCard: {
    backgroundColor: colors.green800,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  fareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  card: { gap: spacing.md },
  bookingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  codeBox: {
    backgroundColor: colors.green50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  flex: { flex: 1 },
  actions: { gap: spacing.sm },
});
