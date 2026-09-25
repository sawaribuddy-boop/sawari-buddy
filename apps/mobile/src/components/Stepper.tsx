import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

export interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  /** Spoken name, e.g. "Seats". */
  label: string;
}

/** − value + control (the concept's "Passengers" stepper). Bounds are UX only; the server re-validates. */
export function Stepper({ value, min, max, onChange, label }: StepperProps) {
  const canDec = value > min;
  const canInc = value < max;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment' && canInc) onChange(value + 1);
        if (e.nativeEvent.actionName === 'decrement' && canDec) onChange(value - 1);
      }}
    >
      <Pressable
        onPress={() => canDec && onChange(value - 1)}
        disabled={!canDec}
        hitSlop={8}
        style={({ pressed }) => [styles.btn, styles.dec, pressed && styles.pressedDec, !canDec && styles.disabled]}
      >
        <Icon name="minus" color={colors.ink700} />
      </Pressable>
      <AppText variant="title" style={styles.value}>
        {value}
      </AppText>
      <Pressable
        onPress={() => canInc && onChange(value + 1)}
        disabled={!canInc}
        hitSlop={8}
        style={({ pressed }) => [styles.btn, styles.inc, pressed && styles.pressedInc, !canInc && styles.disabled]}
      >
        <Icon name="plus" color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  btn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dec: { backgroundColor: '#EEF1EF' },
  inc: { backgroundColor: colors.green600 },
  pressedDec: { backgroundColor: colors.ink300 },
  pressedInc: { backgroundColor: colors.green700 },
  disabled: { opacity: 0.35 },
  value: { minWidth: 28, textAlign: 'center' },
});
