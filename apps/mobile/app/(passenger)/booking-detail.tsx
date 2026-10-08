import { BOOKING_STATUS, type BookingStatus, errorMessageFor, isErrorCode, PAYMENT_STATUS, type PaymentStatus } from '@sawari/constants';
import { firstName as getFirstName, formatRupees, formatTimeAgo } from '@sawari/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  BookingCard,
  type BookingCardData,
  Button,
  Card,
  OfflineBanner,
  RateRideSheet,
  Screen,
  StarRating,
} from '@/components';
import { useCancelBooking, useMyActiveBooking, useMyBooking, useRateBooking } from '@/features/booking';
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
  const rateMutation = useRateBooking();
  const [rateSheetOpen, setRateSheetOpen] = useState(false);

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
  const rating = detailData?.rating as { stars: number; comment: string | null } | null | undefined;

  const status = booking?.status as BookingStatus | undefined;
  const isActive = status === BOOKING_STATUS.CONFIRMED || status === BOOKING_STATUS.BOARDED;

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
    origin: (route?.origin as string) ?? '',
    destination: (route?.destination as string) ?? '',
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

        {status === BOOKING_STATUS.COMPLETED ? <PaymentBanner booking={booking} /> : null}

        {status === BOOKING_STATUS.COMPLETED && rating ? (
          <Card>
            <View style={styles.rating}>
              <AppText variant="small" color={colors.ink500}>
                Your rating
              </AppText>
              <StarRating value={rating.stars} size={24} />
              {rating.comment ? <AppText variant="body">{rating.comment}</AppText> : null}
            </View>
          </Card>
        ) : null}

        {status === BOOKING_STATUS.COMPLETED && detailData && !rating ? (
          <Button label="Rate this ride" variant="secondary" icon="star-outline" onPress={() => setRateSheetOpen(true)} />
        ) : null}
      </View>

      <RateRideSheet
        visible={rateSheetOpen}
        onClose={() => {
          setRateSheetOpen(false);
          rateMutation.reset();
        }}
        onSubmit={(stars, comment) => {
          if (!bookingId) return;
          rateMutation.mutate(
            { bookingId, stars, comment },
            {
              onSuccess: () => setRateSheetOpen(false),
              onError: (error) => {
                if (error.message === 'ALREADY_RATED') setRateSheetOpen(false);
              },
            },
          );
        }}
        origin={cardData.origin}
        destination={cardData.destination}
        driverFirstName={cardData.driverFirstName}
        isLoading={rateMutation.isPending}
        error={rateMutation.isError && rateMutation.error.message !== 'ALREADY_RATED' ? errorMessageFor(rateMutation.error) : undefined}
      />
    </Screen>
  );
}

function PaymentBanner({ booking }: { booking: Record<string, unknown> }) {
  const paymentStatus = booking.payment_status as PaymentStatus | null | undefined;
  const fare = formatRupees((booking.total_fare_paise as number) ?? 0);
  switch (paymentStatus) {
    case PAYMENT_STATUS.PAID:
      return <Banner tone="success" title={`Paid ${fare} in cash`} />;
    case PAYMENT_STATUS.UNPAID:
      return (
        <Banner
          tone="warning"
          title="Marked as not paid"
          message="The driver recorded this ride as unpaid. If you did pay, contact support from Profile → Help & support."
        />
      );
    case PAYMENT_STATUS.PENDING:
      return <Banner tone="info" title={`Pay ${fare} in cash to the driver`} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  rating: { gap: spacing.sm },
});
