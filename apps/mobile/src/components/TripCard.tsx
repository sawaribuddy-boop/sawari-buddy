import { formatRupees } from '@sawari/domain';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { Icon } from './Icon';
import { SeatBar } from './SeatBar';

export interface TripCardData {
  trip_id: string;
  auto_registration: string;
  auto_model: string;
  auto_colour: string;
  driver_first_name: string;
  available_seats: number;
  capacity: number;
  fare_paise: number;
}

export interface TripCardProps {
  trip: TripCardData;
  seatCount: number;
  onBook: () => void;
}

export function TripCard({ trip, seatCount, onBook }: TripCardProps) {
  const { t } = useTranslation();
  const canBook = trip.available_seats >= seatCount;
  return (
    <Card>
      <View style={styles.header}>
        <Icon name="rickshaw" color={colors.autoYellow} size={28} />
        <View style={styles.headerText}>
          <AppText variant="bodyStrong">{trip.auto_registration}</AppText>
          <AppText variant="small" color={colors.ink500}>
            {trip.driver_first_name}
            {trip.auto_model ? ` · ${trip.auto_model}` : ''}
          </AppText>
        </View>
        <View style={styles.fare}>
          <AppText variant="heading" color={colors.green700}>
            {formatRupees(trip.fare_paise)}
          </AppText>
          <AppText variant="caption" color={colors.ink500}>
            {t('tripCard.perSeat')}
          </AppText>
        </View>
      </View>

      <SeatBar occupied={trip.capacity - trip.available_seats} capacity={trip.capacity} />

      <View style={styles.availableRow}>
        <Icon name="seat-passenger" size={16} color={trip.available_seats > 0 ? colors.green700 : colors.warning} />
        <AppText
          variant="bodyStrong"
          color={trip.available_seats > 0 ? colors.green700 : colors.warning}
        >
          {t('tripCard.seatsAvailable', { count: trip.available_seats })}
        </AppText>
      </View>

      <View style={styles.footer}>
        <AppText variant="small" color={colors.ink500}>
          {t('tripCard.seatsSelected', { count: seatCount, label: t('tripCard.seatLabel', { count: seatCount }) })}
        </AppText>
        <Button
          label={canBook ? t('tripCard.bookSeat') : t('tripCard.notEnoughSeats')}
          variant="primary"
          size="md"
          fullWidth={false}
          onPress={onBook}
          disabled={!canBook}
          icon={canBook ? 'check' : undefined}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  headerText: { flex: 1, gap: spacing.xxs },
  fare: { alignItems: 'flex-end' },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    backgroundColor: colors.green50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
});
