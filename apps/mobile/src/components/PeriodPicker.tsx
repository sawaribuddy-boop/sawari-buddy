import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export type EarningsPeriod = 'today' | 'yesterday' | 'this_week' | 'all_time';

export interface PeriodPickerProps {
  onChange: (range: { from?: string; to?: string }, key: EarningsPeriod) => void;
}

const LABELS: { key: EarningsPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'all_time', label: 'All Time' },
];

export function startOfDayIST(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00+05:30`;
}

export function earningsPeriod(preset: EarningsPeriod): { from?: string; to?: string } {
  if (preset === 'today') return {};

  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs + now.getTimezoneOffset() * 60 * 1000);

  if (preset === 'yesterday') {
    const yesterday = new Date(istNow);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayStart = new Date(istNow);
    return { from: startOfDayIST(yesterday), to: startOfDayIST(todayStart) };
  }

  if (preset === 'this_week') {
    const dayOfWeek = istNow.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(istNow);
    monday.setDate(monday.getDate() - mondayOffset);
    return { from: startOfDayIST(monday) };
  }

  return { from: '1970-01-01T00:00:00+05:30' };
}

export const PERIOD_LABELS: Record<EarningsPeriod, string> = {
  today: "Today's summary",
  yesterday: "Yesterday's summary",
  this_week: "This week's summary",
  all_time: 'All time summary',
};

export function PeriodPicker({ onChange }: PeriodPickerProps) {
  const [selected, setSelected] = useState<EarningsPeriod>('today');

  const handlePress = useCallback(
    (key: EarningsPeriod) => {
      setSelected(key);
      onChange(earningsPeriod(key), key);
    },
    [onChange],
  );

  return (
    <View style={styles.row}>
      {LABELS.map(({ key, label }) => {
        const active = selected === key;
        return (
          <Pressable
            key={key}
            onPress={() => handlePress(key)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <AppText variant="small" color={active ? colors.white : colors.ink700}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.green700,
    borderColor: colors.green700,
  },
});
