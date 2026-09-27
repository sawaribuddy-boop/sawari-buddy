import { BOOKING_STATUS, type BookingStatus } from '@sawari/constants';
import { formatRupees } from '@sawari/domain';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { Card } from './Card';
import { Icon } from './Icon';
import type { PillTone } from './StatusPill';
import { StatusPill } from './StatusPill';

export interface BookingCardData {
  code: string;
  status: BookingStatus;
  origin: string;
  destination: string;
  autoRegistration: string;
  driverFirstName: string;
  seatCount: number;
  farePerSeatPaise: number;
  totalFarePaise: number;
  seatPreference: string;
}

export interface BookingCardProps {
  booking: BookingCardData;
}

const STATUS_TONE: Record<BookingStatus, PillTone> = {
  [BOOKING_STATUS.CONFIRMED]: 'success',
  [BOOKING_STATUS.BOARDED]: 'info',
  [BOOKING_STATUS.COMPLETED]: 'neutral',
  [BOOKING_STATUS.CANCELLED]: 'danger',
  [BOOKING_STATUS.NO_SHOW]: 'warning',
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  [BOOKING_STATUS.CONFIRMED]: 'Confirmed',
  [BOOKING_STATUS.BOARDED]: 'Boarded',
  [BOOKING_STATUS.COMPLETED]: 'Completed',
  [BOOKING_STATUS.CANCELLED]: 'Cancelled',
  [BOOKING_STATUS.NO_SHOW]: 'No Show',
};

export function BookingCard({ booking }: BookingCardProps) {
  return (
    <Card>
      <View style={styles.topRow}>
        <AppText variant="caption" color={colors.ink500}>
          #{booking.code}
        </AppText>
        <StatusPill label={STATUS_LABEL[booking.status]} tone={STATUS_TONE[booking.status]} />
      </View>

      <View style={styles.route}>
        <Icon name="map-marker" color={colors.green600} size={18} />
        <AppText variant="bodyStrong">{booking.origin}</AppText>
        <Icon name="arrow-right" color={colors.ink400} size={16} />
        <AppText variant="bodyStrong">{booking.destination}</AppText>
      </View>

      <View style={styles.details}>
        <DetailRow icon="rickshaw" label={`${booking.autoRegistration} · ${booking.driverFirstName}`} />
        <DetailRow icon="seat" label={`${booking.seatCount} ${booking.seatCount === 1 ? 'seat' : 'seats'} · ${booking.seatPreference}`} />
        <DetailRow
          icon="cash"
          label={`${formatRupees(booking.farePerSeatPaise)}/seat × ${booking.seatCount} = ${formatRupees(booking.totalFarePaise)}`}
        />
      </View>
    </Card>
  );
}

function DetailRow({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.detailRow}>
      <Icon name={icon as never} color={colors.ink500} size={16} />
      <AppText variant="small" color={colors.ink700}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  route: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  details: { gap: spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
