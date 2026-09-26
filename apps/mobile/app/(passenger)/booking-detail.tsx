import { BOOKING_STATUS, type BookingStatus, errorMessageFor, isErrorCode } from '@sawari/constants';
import { firstName as getFirstName, formatTimeAgo } from '@sawari/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Banner, BookingCard, type BookingCardData, Button, OfflineBanner, Screen } from '@/components';
import { useCancelBooking, useMyActiveBooking, useMyBooking } from '@/features/booking';
import { useTripChannel } from '@/features/realtime';
import { colors, spacing } from '@/theme';

export default function BookingDetailScreen() {
  const { bookingId, tripId, justBooked } = useLocalSearchParams<{
    bookingId: string;
    tripId?: string;
    justBooked?: string;
  }>();
  const router = useRouter();

  const activeQuery = useMyActiveBooking();
  const detailQuery = useMyBooking(bookingId ?? null);
  const cancelMutation = useCancelBooking();

  const activeData = activeQuery.data as Record<string, unknown> | null;
  const detailData = detailQuery.data as Record<string, unknown> | null;

  const isActiveBooking = activeData != null &&
    (activeData.booking as Record<string, unknown> | undefined)?.id === bookingId;

  const source = isActiveBooking ? activeData : detailData;
  const booking = source?.booking as Record<string, unknown> | undefined;
  const trip = source?.trip as Record<string, unknown> | undefined;
  const route = source?.route as Record<string, unknown> | undefined;
  const auto = source?.auto as Record<string, unknown> | undefined;
  const driver = source?.driver as Record<string, unknown> | undefined;

  const status = booking?.status as BookingStatus | undefined;
  const isActive = status === BOOKING_STATUS.CONFIRMED || status === BOOKING_STATUS.BOARDED;
  const channelTripId = isActive ? (tripId ?? (booking?.trip_id as string | undefined)) : undefined;

  useTripChannel(channelTripId ?? null);

  const handleCancel = () => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No, keep it', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: () => {
          if (bookingId) cancelMutation.mutate(bookingId);
        },
      },
    ]);
  };

  const isLoading = activeQuery.isLoading || detailQuery.isLoading;

  if (isLoading || !booking) {
    return (
      <Screen edges={['top']}>
        <View style={styles.body}>
          <Button label="Back" variant="ghost" icon="arrow-left" fullWidth={false} size="md" onPress={() => router.back()} />
          <AppText variant="body" color={colors.ink500}>
            Loading booking...
          </AppText>
        </View>
      </Screen>
    );
  }

  const cardData: BookingCardData = {
    code: (booking.code as string) ?? '',
    status: status ?? BOOKING_STATUS.CONFIRMED,
    origin: (route?.origin_name as string) ?? '',
    destination: (route?.destination_name as string) ?? '',
    autoRegistration: (auto?.registration_number as string) ?? '',
    driverFirstName: driver?.first_name
      ? (driver.first_name as string)
      : driver?.full_name
        ? getFirstName(driver.full_name as string)
        : '',
    seatCount: (booking.seat_count as number) ?? 1,
    farePerSeatPaise: (booking.fare_per_seat_paise as number) ?? 0,
    totalFarePaise: (booking.total_fare_paise as number) ?? 0,
    seatPreference: (booking.seat_preference as string) ?? 'ANY',
  };

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.body}>
        <Button label="Back" variant="ghost" icon="arrow-left" fullWidth={false} size="md" onPress={() => router.back()} />

        <OfflineBanner />

        {justBooked === '1' ? (
          <Banner tone="success" title="Booking Confirmed!" message="Your seats have been reserved." />
        ) : null}

        {isActive && driver?.reachable === false ? (
          <Banner
            tone="warning"
            title="Driver may be unreachable"
            message={
              driver.last_seen_at
                ? `Last seen ${formatTimeAgo(driver.last_seen_at as string)}`
                : 'The driver has not been seen recently.'
            }
          />
        ) : null}

        {cancelMutation.isError ? (
          <Banner
            tone="danger"
            title={isErrorCode(cancelMutation.error?.message) ? errorMessageFor(cancelMutation.error) : 'Could not cancel booking'}
            message={cancelMutation.error?.message === 'INVALID_TRANSITION' ? 'You may have already boarded.' : undefined}
          />
        ) : null}

        {cancelMutation.isSuccess ? (
          <Banner tone="info" title="Booking cancelled" />
        ) : null}

        <BookingCard booking={cardData} />

        {status === BOOKING_STATUS.CONFIRMED && !cancelMutation.isSuccess ? (
          <Button
            label="Cancel Booking"
            variant="dangerSoft"
            icon="close-circle-outline"
            loading={cancelMutation.isPending}
            onPress={handleCancel}
          />
        ) : null}

        {status === BOOKING_STATUS.BOARDED ? (
          <Banner tone="info" title="You are on board" message="Enjoy your ride!" />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
});
