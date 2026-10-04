import { Pressable, StyleSheet, View } from 'react-native';

import { colors, MIN_TOUCH, spacing } from '@/theme';

import { Icon } from './Icon';

export interface StarRatingProps {
  /** 0 = nothing chosen yet. */
  value: number;
  /** Omit for a read-only display. */
  onChange?: (stars: number) => void;
  size?: number;
}

const STARS = [1, 2, 3, 4, 5] as const;

/** Five stars: tappable when `onChange` is given, otherwise a read-only display. */
export function StarRating({ value, onChange, size = 36 }: StarRatingProps) {
  if (!onChange) {
    return (
      <View style={styles.row} accessible accessibilityLabel={`Rated ${value} out of 5`}>
        {STARS.map((n) => (
          <Icon key={n} name={n <= value ? 'star' : 'star-outline'} size={size} color={colors.autoYellow} />
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.row, styles.gap]} accessibilityRole="radiogroup" accessibilityLabel="Rating">
      {STARS.map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          accessibilityRole="radio"
          accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
          accessibilityState={{ selected: n === value }}
          hitSlop={4}
          style={styles.touch}
        >
          <Icon name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? colors.autoYellow : colors.ink300} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  gap: { justifyContent: 'center', gap: spacing.xs },
  touch: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
