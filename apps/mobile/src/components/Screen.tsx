import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
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
  /** Keep inputs and the footer above the on-screen keyboard (forms). */
  keyboardAvoiding?: boolean;
}

export function Screen({
  children,
  scroll = false,
  background = colors.background,
  padded = true,
  edges = ['top', 'bottom'],
  footer,
  contentStyle,
  keyboardAvoiding = false,
}: ScreenProps) {
  const inner = [padded && styles.padded, contentStyle];
  const body = (
    <>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, inner]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  );
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: background }]}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.sm },
});
