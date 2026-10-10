import { SEAT_PREFERENCE, type SeatPreference, errorMessageFor, isErrorCode } from '@sawari/constants';
import { formatRupees } from '@sawari/domain';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, BookingCard, Button, Card, Icon, Screen, SeatPreferenceRadio } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBookSeats } from '@/features/booking';
import { newIdempotencyKey } from '@/lib/ids';
import { colors, spacing } from '@/theme';

export default function ConfirmScreen() {
  const params = useLocalSearchParams<{
    tripId: string;
    seatCount: string;
    farePaise: string;
    autoRegistration: string;
    driverFirstName: string;
    originId: string;
    destinationId: string;
    originName: string;
    destName: string;
    /** '1' when booking every seat in the auto. */
    wholeAuto?: string;
  }>();
  const router = useRouter();
  const { account } = useAuth();
  const bookMutation = useBookSeats();

  const seatCount = Number(params.seatCount) || 1;
  const farePaise = Number(params.farePaise) || 0;
  const totalFare = farePaise * seatCount;

  const [preference, setPreference] = useState<SeatPreference>(SEAT_PREFERENCE.ANY);
  const idempotencyKeyRef = useRef(newIdempotencyKey());

  // Screens inside the passenger tabs stay mounted after navigating away, so a second visit (e.g.
  // after cancelling by mistake) would find the button disabled and reuse the old key, which the
  // server answers with the earlier, cancelled booking. Start fresh for every booking attempt; a
  // retry within one attempt keeps the same key so it can never double-book.
  const { reset } = bookMutation;
  const startFresh = useCallback(() => {
    idempotencyKeyRef.current = newIdempotencyKey();
    reset();
  }, [reset]);
  useEffect(startFresh, [params.tripId, params.seatCount, startFresh]);
  // Read through a ref so this runs only when the screen comes back into view, not the moment a
  // booking succeeds (which would re-enable the button before navigating away).
  const succeededRef = useRef(false);
  succeededRef.current = bookMutation.isSuccess;
  useFocusEffect(
    useCallback(() => {
      if (succeededRef.current) startFresh();
    }, [startFresh]),
  );

  const handleConfirm = () => {
    bookMutation.mutate(
      {
        tripId: params.tripId ?? '',
        seatCount,
        idempotencyKey: idempotencyKeyRef.current,
        seatPreference: preference,
      },
      {
        onSuccess: (booking) => {
          if (!booking) return;
          router.replace({
            pathname: '/(passenger)/booking-detail',
            params: {
              bookingId: booking.id,
              tripId: booking.trip_id,
              justBooked: '1',
            },
          });
        },
      },
    );
  };

  const errorCode = bookMutation.error?.message;
  const isActiveBookingError = errorCode === 'ALREADY_HAS_ACTIVE_BOOKING';
  const isSeatError = errorCode === 'NO_SEAT_AVAILABLE';
  const isTripError = errorCode === 'TRIP_NOT_BOOKABLE' || errorCode === 'DRIVER_UNREACHABLE';

  return (
    <Screen scroll edges={['top']} footer={
      <Button
        label="Confirm Booking"
        variant="primary"
        icon="check-circle"
        loading={bookMutation.isPending}
        onPress={handleConfirm}
        disabled={bookMutation.isSuccess}
      />
    }>
      <View style={styles.body}>
        <Button
          label="Back"
          variant="ghost"
          icon="arrow-left"
          fullWidth={false}
          size="md"
          onPress={() => router.back()}
        />
        <AppText variant="title">Confirm Your Booking</AppText>

        {bookMutation.isError ? (
          <>
            <Banner
              tone={isActiveBookingError ? 'info' : isSeatError ? 'warning' : 'danger'}
              title={isErrorCode(errorCode) ? errorMessageFor(bookMutation.error) : 'Booking failed'}
              message={
                isSeatError
                  ? undefined
                  : isTripError
                    ? undefined
                    : isActiveBookingError
                      ? undefined
                      : 'You can try again safely.'
              }
            />
            {isActiveBookingError ? (
              <Button
                label="View my booking"
                variant="secondary"
                onPress={() => router.replace('/(passenger)/bookings')}
              />
            ) : null}
            {(isSeatError || isTripError) ? (
              <Button
                label="Back to available autos"
                variant="secondary"
                icon="arrow-left"
                onPress={() => router.back()}
              />
            ) : null}
          </>
        ) : null}

        <Card>
          <View style={styles.routeRow}>
            <Icon name="map-marker" color={colors.green600} size={18} />
            <AppText variant="bodyStrong">{params.originName}</AppText>
            <Icon name="arrow-right" color={colors.ink400} size={16} />
            <AppText variant="bodyStrong">{params.destName}</AppText>
          </View>

          <View style={styles.details}>
            <DetailLine label="Auto" value={params.autoRegistration ?? ''} />
            <DetailLine label="Driver" value={params.driverFirstName ?? ''} />
            <DetailLine label="Seats" value={params.wholeAuto === '1' ? `Whole auto (${seatCount} seats)` : String(seatCount)} />
            <DetailLine label="Fare" value={`${formatRupees(farePaise)}/seat × ${seatCount} = ${formatRupees(totalFare)}`} />
            <DetailLine label="Payment" value="Cash" />
          </View>
        </Card>

        <Card>
          <AppText variant="bodyStrong" style={styles.prefTitle}>
            Passenger
          </AppText>
          <AppText variant="body" color={colors.ink700}>
            {account?.fullName ?? 'Unknown'}
          </AppText>
        </Card>

        <Card>
          <AppText variant="bodyStrong" style={styles.prefTitle}>
            Seat Preference
          </AppText>
          <AppText variant="small" color={colors.ink500} style={styles.prefHint}>
            Preference only — not guaranteed
          </AppText>
          <SeatPreferenceRadio value={preference} onChange={setPreference} />
        </Card>
      </View>
    </Screen>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <AppText variant="small" color={colors.ink500} style={styles.detailLabel}>
        {label}
      </AppText>
      <AppText variant="body">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  details: { gap: spacing.sm },
  detailLine: { flexDirection: 'row', alignItems: 'center' },
  detailLabel: { width: 70 },
  prefTitle: { marginBottom: spacing.xs },
  prefHint: { marginBottom: spacing.md },
});
