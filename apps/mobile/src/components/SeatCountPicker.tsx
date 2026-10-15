import { Pressable, StyleSheet, View } from 'react-native';

import { colors, MIN_TOUCH, radius, spacing } from '@/theme';

import { AppText } from './AppText';

/** A number of seats, or every seat in the auto. */
export type SeatChoice = number | 'whole';

export interface SeatCountPickerProps {
  value: SeatChoice;
  /** Largest number offered before "Whole auto" (max_seats_per_booking). */
  maxSeats: number;
  onChange: (next: SeatChoice) => void;
}

/** "1 · 2 · 3 · 4 · Whole auto" chips on the Book screen. The server re-validates the choice. */
export function SeatCountPicker({ value, maxSeats, onChange }: SeatCountPickerProps) {
  const options: { value: SeatChoice; label: string; a11y: string }[] = [
    ...Array.from({ length: Math.max(1, maxSeats) }, (_, i) => ({
      value: i + 1,
      label: String(i + 1),
      a11y: `${i + 1} ${i === 0 ? 'seat' : 'seats'}`,
    })),
    { value: 'whole', label: 'Whole auto', a11y: 'Whole auto, every seat' },
  ];
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Seats">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={opt.a11y}
            style={[styles.chip, opt.value === 'whole' && styles.wide, selected && styles.selected]}
          >
            <AppText variant="bodyStrong" color={selected ? colors.white : colors.ink700}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "3 seats" / "Whole auto (5 seats)". */
export function seatChoiceLabel(choice: SeatChoice, capacity?: number): string {
  if (choice === 'whole') return capacity ? `Whole auto (${capacity} seats)` : 'Whole auto';
  return `${choice} ${choice === 1 ? 'seat' : 'seats'}`;
}

/** URL param form: "whole" or the number. */
export function parseSeatChoice(param: string | undefined): SeatChoice {
  if (param === 'whole') return 'whole';
  const n = Number(param);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wide: { paddingHorizontal: spacing.lg },
  selected: { backgroundColor: colors.green600, borderColor: colors.green600 },
});
