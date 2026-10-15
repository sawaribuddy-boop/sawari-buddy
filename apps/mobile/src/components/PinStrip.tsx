import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

export interface PinStripProps {
  pin: string;
}

/** Green strip at the bottom of passenger screens: the boarding PIN the driver asks for. */
export function PinStrip({ pin }: PinStripProps) {
  return (
    <View
      style={styles.strip}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Boarding PIN ${pin.split('').join(' ')}. Tell the driver when you get in.`}
    >
      <Icon name="shield-key-outline" size={26} color={colors.white} />
      <View style={styles.text}>
        <AppText variant="caption" color={colors.green100} style={styles.label}>
          BOARDING PIN
        </AppText>
        <AppText variant="small" color={colors.white}>
          Tell the driver when you get in
        </AppText>
      </View>
      <AppText variant="title" color={colors.white} style={styles.pin}>
        {pin}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.green700,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  text: { flex: 1, gap: spacing.xxs },
  label: { letterSpacing: 1 },
  pin: { letterSpacing: 6, fontVariant: ['tabular-nums'] },
});
