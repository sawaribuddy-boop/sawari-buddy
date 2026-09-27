import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

export interface BrandMarkProps {
  size?: number;
  withWordmark?: boolean;
  onDark?: boolean;
}

/** PLACEHOLDER brand mark (D5): replace with the final logo asset when provided. */
export function BrandMark({ size = 44, withWordmark = true, onDark = false }: BrandMarkProps) {
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel="SawariBuddy">
      <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.3 }]}>
        <Icon name="rickshaw" size={size * 0.62} color={colors.green800} />
      </View>
      {withWordmark ? (
        <AppText variant="heading" color={onDark ? colors.white : colors.green800}>
          Sawari<AppText variant="heading" color={colors.autoYellow}>Buddy</AppText>
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { backgroundColor: colors.autoYellow, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
});
