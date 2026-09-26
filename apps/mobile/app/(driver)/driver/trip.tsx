import { BOOKING_STATUS, TRIP_STATUS, errorMessageFor, isErrorCode } from '@sawari/constants';
import { formatRupees, secondsUntil } from '@sawari/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  Button,
  Card,
  Icon,
  Screen,
  SeatBar,
  Sheet,
  StatusPill,
  Stepper,
  TextField,
} from '@/components';
import {
  useAddWalkIn,
  useCancelTrip,
  useDriverHome,
  useFinalCall,
  useMarkBoarded,
  useMarkNoShow,
  useRemoveWalkIn,
  useResumeTrip,
  useStartTrip,
  useTripManifest,
} from '@/features/driver';
import { useTripChannel } from '@/features/realtime';
import { colors, spacing } from '@/theme';

type Booking = {
  id: string;
  code: string;
  source: string;
  status: string;
  seat_count: number;
  seat_preference: string | null;
  passenger_first_name: string | null;
  walk_in_label: string | null;
  total_fare_paise: number;
  boarded_at: string | null;
};

export default function TripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  const { data: rawHome, refetch } = useDriverHome();
  const { data: rawManifest } = useTripManifest(tripId ?? '');

  useTripChannel(tripId);

  const finalCallMutation = useFinalCall();
  const startTripMutation = useStartTrip();
  const cancelTripMutation = useCancelTrip();
  const resumeTripMutation = useResumeTrip();
  const markBoardedMutation = useMarkBoarded();
  const markNoShowMutation = useMarkNoShow();
  const addWalkInMutation = useAddWalkIn();
  const removeWalkInMutation = useRemoveWalkIn();

  const [walkInSheetVisible, setWalkInSheetVisible] = useState(false);
  const [walkInSeats, setWalkInSeats] = useState(1);
  const [walkInLabel, setWalkInLabel] = useState('');
  const [noShowTick, setNoShowTick] = useState(0);

  const home = rawHome as Record<string, unknown> | null;
  const activeTrip = home?.active_trip as Record<string, unknown> | null;
  const trip = activeTrip?.trip as Record<string, unknown> | null;
  const bookings = (activeTrip?.bookings ?? []) as Booking[];
  const route = activeTrip?.route as { origin: string; destination: string } | null;
  const status = trip?.status as string | undefined;
  const capacity = (trip?.capacity ?? 0) as number;
  const occupiedSeats = (activeTrip?.occupied_seats ?? 0) as number;
  const noShowEligibleAt = trip?.no_show_eligible_at as string | null;

  // No-show countdown timer
  useEffect(() => {
    if (!noShowEligibleAt || status !== TRIP_STATUS.BOARDING) return;
    const id = setInterval(() => setNoShowTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [noShowEligibleAt, status]);

  const noShowSecondsLeft = noShowEligibleAt ? secondsUntil(noShowEligibleAt) : 0;
  const noShowAllowed = status === TRIP_STATUS.BOARDING && noShowSecondsLeft <= 0;

  const hasConfirmed = bookings.some((b) => b.status === BOOKING_STATUS.CONFIRMED);
  const hasBoarded = bookings.some((b) => b.status === BOOKING_STATUS.BOARDED);
  const canStart = !hasConfirmed && hasBoarded;

  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const handleAddWalkIn = useCallback(() => {
    if (!tripId) return;
    addWalkInMutation.mutate(
      {
        tripId,
        seatCount: walkInSeats,
        idempotencyKey: idempotencyKeyRef.current,
        label: walkInLabel.trim() || undefined,
      },
      {
        onSuccess: () => {
          setWalkInSheetVisible(false);
          setWalkInSeats(1);
          setWalkInLabel('');
          idempotencyKeyRef.current = crypto.randomUUID();
        },
      },
    );
  }, [tripId, walkInSeats, walkInLabel, addWalkInMutation]);

  const handleFinalCall = useCallback(() => {
    if (!tripId) return;
    finalCallMutation.mutate(tripId);
  }, [tripId, finalCallMutation]);

  const handleStartTrip = useCallback(() => {
    if (!tripId) return;
    startTripMutation.mutate(tripId, {
      onSuccess: () => {
        router.replace({ pathname: '/driver/trip-in-progress', params: { tripId } });
      },
    });
  }, [tripId, startTripMutation, router]);

  const handleCancelTrip = useCallback(() => {
    if (!tripId) return;
    cancelTripMutation.mutate(
      { tripId, reason: 'DRIVER_CANCELLED' },
      { onSuccess: () => router.back() },
    );
  }, [tripId, cancelTripMutation, router]);

  const handleResumeTrip = useCallback(() => {
    if (!tripId) return;
    resumeTripMutation.mutate(tripId);
  }, [tripId, resumeTripMutation]);

  // Redirect if trip moved to IN_PROGRESS
  useEffect(() => {
    if (status === TRIP_STATUS.IN_PROGRESS && tripId) {
      router.replace({ pathname: '/driver/trip-in-progress', params: { tripId } });
    }
    if (status === TRIP_STATUS.COMPLETED || status === TRIP_STATUS.CANCELLED) {
      router.back();
    }
  }, [status, tripId, router]);

  if (!trip) {
    return (
      <Screen edges={['top']}>
        <View style={styles.body}>
          <Button label="Back" variant="ghost" icon="arrow-left" fullWidth={false} size="md" onPress={() => router.back()} />
          <AppText variant="title">Loading trip...</AppText>
        </View>
      </Screen>
    );
  }

  const isMutating =
    finalCallMutation.isPending ||
    startTripMutation.isPending ||
    cancelTripMutation.isPending ||
    resumeTripMutation.isPending ||
    markBoardedMutation.isPending ||
    markNoShowMutation.isPending ||
    addWalkInMutation.isPending ||
    removeWalkInMutation.isPending;

  const mutationError =
    finalCallMutation.error ??
    startTripMutation.error ??
    cancelTripMutation.error ??
    resumeTripMutation.error ??
    markBoardedMutation.error ??
    markNoShowMutation.error ??
    addWalkInMutation.error ??
    removeWalkInMutation.error;

  return (
    <Screen
      scroll
      edges={['top']}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refetch()} />}
    >
      <View style={styles.body}>
        <Button label="Back" variant="ghost" icon="arrow-left" fullWidth={false} size="md" onPress={() => router.back()} />

        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <AppText variant="title">
              {route?.origin} → {route?.destination}
            </AppText>
            <AppText variant="small" color={colors.ink500}>
              {formatRupees((trip.fare_paise as number) ?? 0)}/seat
            </AppText>
          </View>
          <StatusPill
            label={status ?? ''}
            tone={
              status === TRIP_STATUS.BOARDING
                ? 'warning'
                : status === TRIP_STATUS.SUSPENDED
                  ? 'danger'
                  : 'success'
            }
          />
        </View>

        {status === TRIP_STATUS.SUSPENDED ? (
          <>
            <Banner tone="danger" title="Trip suspended" message="You were unreachable. Resume to continue." />
            <Button
              label="Resume Trip"
              variant="primary"
              icon="play-circle-outline"
              loading={resumeTripMutation.isPending}
              onPress={handleResumeTrip}
            />
          </>
        ) : null}

        {mutationError ? (
          <Banner
            tone="danger"
            title="Error"
            message={isErrorCode(mutationError.message) ? errorMessageFor(mutationError) : mutationError.message}
          />
        ) : null}

        <SeatBar occupied={occupiedSeats} capacity={capacity} />

        {/* Manifest */}
        <AppText variant="heading">Passengers</AppText>
        {bookings.length === 0 ? (
          <AppText variant="body" color={colors.ink500}>
            No passengers yet
          </AppText>
        ) : null}

        {bookings.map((b) => (
          <Card key={b.id}>
            <View style={styles.bookingHeader}>
              <View style={styles.codeBox}>
                <AppText variant="bodyStrong">{b.code}</AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="body">
                  {b.source === 'WALK_IN' ? b.walk_in_label || 'Walk-in' : b.passenger_first_name || 'Passenger'}
                </AppText>
                <AppText variant="small" color={colors.ink500}>
                  {b.seat_count} {b.seat_count === 1 ? 'seat' : 'seats'}
                  {b.seat_preference && b.seat_preference !== 'ANY' ? ` · ${b.seat_preference}` : ''}
                </AppText>
              </View>
              <StatusPill
                label={b.status}
                tone={
                  b.status === BOOKING_STATUS.BOARDED
                    ? 'success'
                    : b.status === BOOKING_STATUS.CONFIRMED
                      ? 'info'
                      : 'neutral'
                }
              />
            </View>

            <View style={styles.bookingActions}>
              {b.status === BOOKING_STATUS.CONFIRMED ? (
                <Button
                  label="Mark Boarded"
                  variant="primary"
                  size="md"
                  fullWidth={false}
                  icon="check"
                  loading={markBoardedMutation.isPending}
                  onPress={() => markBoardedMutation.mutate(b.id)}
                />
              ) : null}
              {b.status === BOOKING_STATUS.BOARDED && b.source === 'APP' && noShowAllowed ? (
                <Button
                  label="No-show"
                  variant="ghost"
                  size="md"
                  fullWidth={false}
                  icon="account-remove-outline"
                  loading={markNoShowMutation.isPending}
                  onPress={() => markNoShowMutation.mutate(b.id)}
                />
              ) : null}
              {b.status === BOOKING_STATUS.BOARDED &&
              b.source === 'WALK_IN' &&
              (status === TRIP_STATUS.OPEN || status === TRIP_STATUS.BOARDING) ? (
                <Button
                  label="Remove"
                  variant="ghost"
                  size="md"
                  fullWidth={false}
                  icon="close"
                  loading={removeWalkInMutation.isPending}
                  onPress={() => removeWalkInMutation.mutate(b.id)}
                />
              ) : null}
            </View>
          </Card>
        ))}

        {/* No-show countdown */}
        {status === TRIP_STATUS.BOARDING && noShowEligibleAt && noShowSecondsLeft > 0 ? (
          <AppText variant="small" color={colors.warning}>
            No-show available in {noShowSecondsLeft}s
          </AppText>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          {status === TRIP_STATUS.OPEN ? (
            <Button
              label="Final Call"
              variant="secondary"
              icon="bullhorn-outline"
              loading={finalCallMutation.isPending}
              disabled={isMutating}
              onPress={handleFinalCall}
            />
          ) : null}

          {(status === TRIP_STATUS.OPEN || status === TRIP_STATUS.BOARDING) ? (
            <Button
              label="Add Walk-in"
              variant="secondary"
              icon="account-plus-outline"
              disabled={isMutating || occupiedSeats >= capacity}
              onPress={() => {
                setWalkInSheetVisible(true);
                setWalkInSeats(1);
                setWalkInLabel('');
                idempotencyKeyRef.current = crypto.randomUUID();
              }}
            />
          ) : null}

          {(status === TRIP_STATUS.OPEN || status === TRIP_STATUS.BOARDING) && canStart ? (
            <Button
              label="Start Trip"
              variant="primary"
              icon="play"
              loading={startTripMutation.isPending}
              disabled={isMutating}
              onPress={handleStartTrip}
            />
          ) : null}

          {(status === TRIP_STATUS.OPEN || status === TRIP_STATUS.BOARDING) ? (
            <Button
              label="Cancel Trip"
              variant="ghost"
              icon="close-circle-outline"
              loading={cancelTripMutation.isPending}
              disabled={isMutating}
              onPress={handleCancelTrip}
            />
          ) : null}
        </View>
      </View>

      {/* Walk-in sheet */}
      <Sheet visible={walkInSheetVisible} onClose={() => setWalkInSheetVisible(false)} title="Add Walk-in Passenger">
        <View style={styles.sheetBody}>
          <View style={styles.sheetRow}>
            <AppText variant="bodyStrong">Seats</AppText>
            <Stepper
              value={walkInSeats}
              min={1}
              max={Math.max(capacity - occupiedSeats, 1)}
              onChange={setWalkInSeats}
              label="Seats"
            />
          </View>
          <TextField
            label="Label (optional)"
            placeholder="e.g. Uncle ji"
            value={walkInLabel}
            onChangeText={setWalkInLabel}
          />
          {addWalkInMutation.isError ? (
            <Banner tone="danger" title="Error" message={addWalkInMutation.error.message} />
          ) : null}
          <Button
            label="Add Walk-in"
            variant="primary"
            icon="account-plus"
            loading={addWalkInMutation.isPending}
            onPress={handleAddWalkIn}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1 },
  bookingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  codeBox: {
    backgroundColor: colors.green50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  bookingActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  sheetBody: { gap: spacing.lg },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
