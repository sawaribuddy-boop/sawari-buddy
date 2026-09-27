import { BOOKING_STATUS, type BookingStatus } from '@sawari/constants';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, MIN_TOUCH, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';
import type { PillTone } from './StatusPill';
import { StatusPill } from './StatusPill';

export interface BookingHistoryRowData {
  id: string;
  code: string;
  status: BookingStatus;
  origin: string;
  destination: string;
  createdAt: string;
}

export interface BookingHistoryRowProps {
  booking: BookingHistoryRowData;
  onPress: () => void;
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function BookingHistoryRow({ booking, onPress }: BookingHistoryRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Booking ${booking.code}, ${booking.origin} to ${booking.destination}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.left}>
        <View style={styles.topLine}>
          <AppText variant="caption" color={colors.ink500}>
            #{booking.code}
          </AppText>
          <StatusPill label={STATUS_LABEL[booking.status]} tone={STATUS_TONE[booking.status]} />
        </View>
        <View style={styles.route}>
          <AppText variant="bodyStrong">{booking.origin}</AppText>
          <Icon name="arrow-right" color={colors.ink400} size={14} />
          <AppText variant="bodyStrong">{booking.destination}</AppText>
        </View>
        <AppText variant="caption" color={colors.ink400}>
          {formatDate(booking.createdAt)}
        </AppText>
      </View>
      <Icon name="chevron-right" color={colors.ink400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH + 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.green50 },
  left: { flex: 1, gap: spacing.xs },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  route: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
