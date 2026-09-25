import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Scrollable content (forms, lists). Defaults to a fixed layout. */
  scroll?: boolean;
  background?: string;
  padded?: boolean;
  edges?: Edge[];
  /** Pinned to the bottom, outside the scroll area (primary actions). */
  footer?: ReactNode;
  contentStyle?: ViewStyle;
}

export function Screen({
  children,
  scroll = false,
  background = colors.background,
  padded = true,
  edges = ['top', 'bottom'],
  footer,
  contentStyle,
}: ScreenProps) {
  const inner = [padded && styles.padded, contentStyle];
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, inner]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.sm },
});
