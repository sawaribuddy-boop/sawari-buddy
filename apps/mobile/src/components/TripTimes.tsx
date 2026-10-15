import { formatTripTime } from '@sawari/domain';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { Card } from './Card';

export interface TripTime {
  label: string;
  /** ISO timestamp; rows without one are left out. */
  at: string | null | undefined;
}

/** "Booked 10:02 am · Ride started 10:20 am · Dropped off 10:45 am" as a small card of rows. */
export function TripTimes({ times }: { times: TripTime[] }) {
  const shown = times.filter((t): t is { label: string; at: string } => !!t.at);
  if (shown.length === 0) return null;
  return (
    <Card>
      <View style={styles.list}>
        {shown.map((t) => (
          <View key={t.label} style={styles.row}>
            <AppText variant="small" color={colors.ink500}>
              {t.label}
            </AppText>
            <AppText variant="small" color={colors.ink900} style={styles.time}>
              {formatTripTime(t.at)}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  time: { fontWeight: '600' },
});
