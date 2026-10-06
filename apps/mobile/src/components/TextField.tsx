import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

import { AppText } from './AppText';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, onFocus, onBlur, editable = true, multiline, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.green600 : colors.border;
  return (
    <View style={styles.wrap}>
      <AppText variant="small" color={colors.ink700} style={styles.label}>
        {label}
      </AppText>
      <TextInput
        {...rest}
        editable={editable}
        multiline={multiline}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.ink400}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, multiline && styles.multiline, { borderColor }, !editable && styles.readOnly]}
      />
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color={colors.ink500}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontWeight: '600' },
  input: {
    ...typography.body,
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    color: colors.ink900,
  },
  // Android centres multiline text vertically and iOS adds no top padding: pin text to the top on both.
  multiline: { minHeight: 96, paddingTop: spacing.md, paddingBottom: spacing.md, textAlignVertical: 'top' },
  readOnly: { backgroundColor: colors.background, color: colors.ink500 },
});
