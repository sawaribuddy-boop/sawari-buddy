import { formatRupees } from '@sawari/domain';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

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
            per seat
          </AppText>
        </View>
      </View>

      <SeatBar occupied={trip.capacity - trip.available_seats} capacity={trip.capacity} />

      <View style={styles.footer}>
        <AppText variant="small" color={colors.ink500}>
          {seatCount} {seatCount === 1 ? 'seat' : 'seats'} selected
        </AppText>
        <Button
          label={canBook ? 'Book Seat' : 'Not enough seats'}
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
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
});
