import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export interface SeatBarProps {
  occupied: number;
  capacity: number;
}

/**
 * "3 / 5 filled" occupancy bar from the driver concept. One segment per seat of capacity,
 * deliberately unnumbered: V1 has no seat assignment.
 */
export function SeatBar({ occupied, capacity }: SeatBarProps) {
  const filled = Math.min(Math.max(occupied, 0), capacity);
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${filled} of ${capacity} seats filled`}
      accessibilityValue={{ min: 0, max: capacity, now: filled }}>
      <View style={styles.header}>
        <AppText variant="small" color={colors.ink500}>
          Seats
        </AppText>
        <AppText variant="small" color={colors.ink900} style={styles.count}>
          {filled} / {capacity} filled
        </AppText>
      </View>
      <View style={styles.track}>
        {Array.from({ length: capacity }, (_, i) => (
          <View key={i} style={[styles.segment, i < filled ? styles.full : styles.empty]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  count: { fontWeight: '700' },
  track: { flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 10, borderRadius: radius.pill },
  full: { backgroundColor: colors.green600 },
  empty: { backgroundColor: '#E7ECE9' },
});
