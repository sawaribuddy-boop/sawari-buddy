import { Pressable, StyleSheet, View } from 'react-native';

import { SEAT_PREFERENCE, type SeatPreference } from '@sawari/constants';

import { colors, MIN_TOUCH, radius, spacing } from '@/theme';

import { AppText } from './AppText';

const OPTIONS: { value: SeatPreference; label: string }[] = [
  { value: SEAT_PREFERENCE.ANY, label: 'Any Seat' },
  { value: SEAT_PREFERENCE.BACK, label: 'Back Seat' },
  { value: SEAT_PREFERENCE.FRONT, label: 'Front Seat' },
];

export interface SeatPreferenceRadioProps {
  value: SeatPreference;
  onChange: (next: SeatPreference) => void;
}

export function SeatPreferenceRadio({ value, onChange }: SeatPreferenceRadioProps) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Seat preference">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={opt.label}
            style={[styles.option, selected && styles.selected]}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected ? <View style={styles.dot} /> : null}
            </View>
            <AppText variant="body" color={selected ? colors.green700 : colors.ink700}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  selected: { borderColor: colors.green600, backgroundColor: colors.green50 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.ink400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.green600 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green600 },
});
