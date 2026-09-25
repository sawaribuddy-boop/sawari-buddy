import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export type PillTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const tones: Record<PillTone, { bg: string; fg: string }> = {
  success: { bg: colors.green100, fg: colors.green700 },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  neutral: { bg: '#F1F3F2', fg: colors.ink500 },
};

export interface StatusPillProps {
  label: string;
  tone?: PillTone;
}

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  const t = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]} accessibilityRole="text" accessibilityLabel={label}>
      <AppText variant="caption" color={t.fg}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
});
