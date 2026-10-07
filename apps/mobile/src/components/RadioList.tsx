import { Pressable, StyleSheet, View } from 'react-native';

import { colors, MIN_TOUCH, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export interface RadioListProps<T extends string> {
  label: string;
  options: readonly RadioOption<T>[];
  value: T | null;
  onChange: (next: T) => void;
}

/** Single-choice list of bordered options (seat preference, problem type, which ride). */
export function RadioList<T extends string>({ label, options, value, onChange }: RadioListProps<T>) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={opt.hint ? `${opt.label}, ${opt.hint}` : opt.label}
            style={[styles.option, selected && styles.selected]}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected ? <View style={styles.dot} /> : null}
            </View>
            <View style={styles.text}>
              <AppText variant="body" color={selected ? colors.green700 : colors.ink700}>
                {opt.label}
              </AppText>
              {opt.hint ? (
                <AppText variant="caption" color={colors.ink500}>
                  {opt.hint}
                </AppText>
              ) : null}
            </View>
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
  text: { flex: 1, gap: spacing.xxs },
});
