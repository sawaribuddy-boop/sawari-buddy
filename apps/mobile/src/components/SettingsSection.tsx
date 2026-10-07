import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { Card } from './Card';

export interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

/** Titled group of rows on the Profile screens ("Account", "Help & support", "About"). */
export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View style={styles.wrap}>
      <AppText variant="caption" color={colors.ink500} style={styles.title}>
        {title.toUpperCase()}
      </AppText>
      <Card style={styles.card}>{children}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  title: { letterSpacing: 0.6, paddingHorizontal: spacing.xs },
  card: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
});
