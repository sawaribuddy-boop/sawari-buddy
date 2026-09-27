import { BOOKING_STATUS, errorMessageFor, isErrorCode } from '@sawari/constants';
import { formatRupees } from '@sawari/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { useKeepAwake } from 'expo-keep-awake';

import { AppText, Banner, Button, Card, Icon, OfflineBanner, Screen, SeatBar, StatusPill } from '@/components';
import { useCompleteTrip, useDriverHome } from '@/features/driver';
import { useTripChannel } from '@/features/realtime';
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
};

export default function TripInProgressScreen() {
  useKeepAwake();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  const { data: rawHome, refetch } = useDriverHome();
  const completeTripMutation = useCompleteTrip();

  useTripChannel(tripId);

  const home = rawHome as Record<string, unknown> | null;
  const activeTrip = home?.active_trip as Record<string, unknown> | null;
  const trip = activeTrip?.trip as Record<string, unknown> | null;
  const route = activeTrip?.route as { origin: string; destination: string } | null;
  const bookings = (activeTrip?.bookings ?? []) as Booking[];
  const status = trip?.status as string | undefined;
  const capacity = (trip?.capacity ?? 0) as number;
  const occupiedSeats = (activeTrip?.occupied_seats ?? 0) as number;

  const handleComplete = useCallback(() => {
    if (!tripId) return;
    completeTripMutation.mutate(tripId, { onSuccess: () => router.back() });
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

  const boardedBookings = bookings.filter((b) => b.status === BOOKING_STATUS.BOARDED);
  const totalFare = boardedBookings.reduce((sum, b) => sum + b.total_fare_paise, 0);

  return (
    <Screen
      scroll
      edges={['top']}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refetch()} />}
      footer={
        <Button
          label="Complete Trip"
          variant="primary"
          icon="check-circle"
          loading={completeTripMutation.isPending}
          onPress={handleComplete}
        />
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
        </View>

        {completeTripMutation.isError ? (
          <Banner
            tone="danger"
            title="Error"
            message={
              isErrorCode(completeTripMutation.error.message)
                ? errorMessageFor(completeTripMutation.error)
                : completeTripMutation.error.message
            }
          />
        ) : null}

        <SeatBar occupied={occupiedSeats} capacity={capacity} />

        <Card>
          <View style={styles.fareRow}>
            <AppText variant="bodyStrong">Total fare to collect</AppText>
            <AppText variant="heading" color={colors.green700}>
              {formatRupees(totalFare)}
            </AppText>
          </View>
          <AppText variant="small" color={colors.ink500}>
            Cash · {boardedBookings.length} {boardedBookings.length === 1 ? 'booking' : 'bookings'}
          </AppText>
        </Card>

        <AppText variant="heading">Passengers on board</AppText>
        {boardedBookings.map((b) => (
          <Card key={b.id}>
            <View style={styles.bookingRow}>
              <View style={styles.codeBox}>
                <AppText variant="bodyStrong">{b.code}</AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="body">
                  {b.source === 'WALK_IN' ? b.walk_in_label || 'Walk-in' : b.passenger_first_name || 'Passenger'}
                </AppText>
                <AppText variant="small" color={colors.ink500}>
                  {b.seat_count} {b.seat_count === 1 ? 'seat' : 'seats'} · {formatRupees(b.total_fare_paise)}
                </AppText>
              </View>
              <StatusPill label="On board" tone="success" />
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
  bookingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  codeBox: {
    backgroundColor: colors.green50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  flex: { flex: 1 },
});
