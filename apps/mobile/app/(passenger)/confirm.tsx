import { errorMessageFor, isErrorCode } from '@sawari/constants';
import { formatRupees } from '@sawari/domain';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Banner, Button, Card, Icon, Screen, SeatDiagram } from '@/components';
import { useBookSeats } from '@/features/booking';
import { colors, spacing } from '@/theme';

export default function ConfirmScreen() {
  const { t } = useTranslation();
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
    capacity: string;
    availableSeats: string;
  }>();
  const router = useRouter();
  const bookMutation = useBookSeats();

  const capacity = Number(params.capacity) || 5;
  const availableSeats = Number(params.availableSeats) || capacity;
  const occupiedSeats = capacity - availableSeats;
  const passengerCount = Number(params.seatCount) || 1;
  const maxSeats = Math.min(passengerCount, availableSeats);

  const [seatMode, setSeatMode] = useState<'any' | 'specific'>('any');
  const [selectedSeats, setSelectedSeats] = useState(passengerCount);
  const farePaise = Number(params.farePaise) || 0;
  const totalFare = farePaise * selectedSeats;

  const idempotencyKeyRef = useRef(randomUUID());

  const handleConfirm = () => {
    bookMutation.mutate(
      {
        tripId: params.tripId ?? '',
        seatCount: seatMode === 'any' ? passengerCount : selectedSeats,
        idempotencyKey: idempotencyKeyRef.current,
        seatPreference: 'ANY',
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
        label={t('confirm.confirmButton')}
        variant="primary"
        icon="check-circle"
        loading={bookMutation.isPending}
        onPress={handleConfirm}
        disabled={bookMutation.isSuccess}
      />
    }>
      <View style={styles.body}>
        <View style={styles.backBtn}>
          <Button
            label={t('common.back')}
            variant="ghost"
            icon="arrow-left"
            fullWidth={false}
            size="md"
            onPress={() =>
              router.replace({
                pathname: '/(passenger)/search-results',
                params: {
                  originId: params.originId ?? '',
                  destinationId: params.destinationId ?? '',
                  seatCount: String(passengerCount),
                },
              })
            }
          />
        </View>
        <AppText variant="title">{t('confirm.title')}</AppText>

        {bookMutation.isError ? (
          <>
            <Banner
              tone={isActiveBookingError ? 'info' : isSeatError ? 'warning' : 'danger'}
              title={isErrorCode(errorCode) ? errorMessageFor(bookMutation.error) : t('confirm.bookingFailed')}
              message={
                isSeatError
                  ? undefined
                  : isTripError
                    ? undefined
                    : isActiveBookingError
                      ? undefined
                      : t('confirm.tryAgainSafely')
              }
            />
            {isActiveBookingError ? (
              <Button
                label={t('confirm.viewMyBooking')}
                variant="secondary"
                onPress={() => router.replace('/(passenger)/bookings')}
              />
            ) : null}
            {(isSeatError || isTripError) ? (
              <Button
                label={t('confirm.backToAutos')}
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

          <View style={styles.tripInfoRow}>
            <View style={styles.details}>
              <DetailLine label={t('confirm.auto')} value={params.autoRegistration ?? ''} />
              <DetailLine label={t('confirm.driver')} value={params.driverFirstName ?? ''} />
              <DetailLine label={t('confirm.seats')} value={String(seatMode === 'any' ? passengerCount : selectedSeats)} />
              <DetailLine label={t('confirm.fare')} value={`${formatRupees(farePaise)}/${t('common.perSeat')} × ${seatMode === 'any' ? passengerCount : selectedSeats} = ${formatRupees(farePaise * (seatMode === 'any' ? passengerCount : selectedSeats))}`} />
              <DetailLine label={t('confirm.payment')} value={t('common.cash')} />
            </View>

            <View style={styles.driverPhoto}>
              <Icon name="account" size={36} color={colors.green700} />
            </View>
          </View>
        </Card>

        <Card>
          <AppText variant="bodyStrong" style={styles.prefTitle}>
            {t('confirm.selectSeats')}
          </AppText>

          <Pressable
            style={styles.radioRow}
            onPress={() => setSeatMode('any')}
          >
            <Icon
              name={seatMode === 'any' ? 'radiobox-marked' : 'radiobox-blank'}
              size={22}
              color={seatMode === 'any' ? colors.green700 : colors.ink400}
            />
            <View style={styles.radioText}>
              <AppText variant="body">{t('confirm.anySeat')}</AppText>
              <AppText variant="small" color={colors.ink500}>{t('confirm.anySeatHint')}</AppText>
            </View>
          </Pressable>

          <Pressable
            style={styles.radioRow}
            onPress={() => setSeatMode('specific')}
          >
            <Icon
              name={seatMode === 'specific' ? 'radiobox-marked' : 'radiobox-blank'}
              size={22}
              color={seatMode === 'specific' ? colors.green700 : colors.ink400}
            />
            <View style={styles.radioText}>
              <AppText variant="body">{t('confirm.specificSeat')}</AppText>
              <AppText variant="small" color={colors.ink500}>{t('confirm.specificSeatHint')}</AppText>
            </View>
          </Pressable>

          {seatMode === 'specific' ? (
            <>
              <View style={styles.diagramDivider} />
              <AppText variant="small" color={colors.ink500} style={styles.prefHint}>
                {t('confirm.seatsHint', { selected: selectedSeats, available: availableSeats })}
              </AppText>
              <SeatDiagram
                capacity={capacity}
                occupiedSeats={occupiedSeats}
                selectedSeats={selectedSeats}
                onSelectSeats={setSelectedSeats}
                maxSelectable={maxSeats}
              />
            </>
          ) : null}
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
  backBtn: { alignItems: 'flex-start' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  tripInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  details: { flex: 1, gap: spacing.sm },
  detailLine: { flexDirection: 'row', alignItems: 'center' },
  detailLabel: { width: 70 },
  driverPhoto: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.green50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.green100,
  },
  prefTitle: { marginBottom: spacing.md },
  prefHint: { marginBottom: spacing.sm },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  radioText: { flex: 1, gap: 2 },
  diagramDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
});
