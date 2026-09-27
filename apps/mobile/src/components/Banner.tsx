import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type BannerTone = 'info' | 'warning' | 'danger' | 'success';

const tones: Record<BannerTone, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: colors.infoSoft, fg: colors.info, icon: 'information-outline' },
  warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'alert-outline' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle-outline' },
  success: { bg: colors.green50, fg: colors.green700, icon: 'check-circle-outline' },
};

export interface BannerProps {
  tone?: BannerTone;
  title: string;
  message?: string;
}

/** Inline notice: offline, driver unreachable, final call, errors. */
export function Banner({ tone = 'info', title, message }: BannerProps) {
  const t = tones[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg }]} accessibilityRole="alert">
      <Icon name={t.icon} color={t.fg} />
      <View style={styles.text}>
        <AppText variant="bodyStrong" color={t.fg}>
          {title}
        </AppText>
        {message ? (
          <AppText variant="small" color={colors.ink700}>
            {message}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, alignItems: 'flex-start' },
  text: { flex: 1, gap: spacing.xxs },
});
