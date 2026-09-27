import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { colors, MIN_TOUCH, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'dangerSoft' | 'ghost' | 'onDark';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'md' | 'lg';
}

const palette: Record<ButtonVariant, { bg: string; bgPressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.green600, bgPressed: colors.green700, fg: colors.white },
  secondary: { bg: colors.surface, bgPressed: colors.green50, fg: colors.green700, border: colors.green600 },
  dangerSoft: { bg: colors.dangerSoft, bgPressed: '#F9D7D7', fg: colors.danger },
  ghost: { bg: 'transparent', bgPressed: colors.green50, fg: colors.green700 },
  onDark: { bg: colors.white, bgPressed: colors.green50, fg: colors.green800 },
};

export function Button({
  label,
  variant = 'primary',
  icon,
  loading = false,
  fullWidth = true,
  size = 'lg',
  disabled,
  ...rest
}: ButtonProps) {
  const p = palette[variant];
  const isDisabled = disabled === true || loading;
  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={size === 'md' ? 4 : 0}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        { backgroundColor: pressed ? p.bgPressed : p.bg },
        p.border ? { borderWidth: 1.5, borderColor: p.border } : null,
        fullWidth ? styles.fullWidth : null,
        isDisabled ? styles.disabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={20} color={p.fg} /> : null}
          <AppText variant="bodyStrong" color={p.fg}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  lg: { minHeight: 54 },
  md: { minHeight: MIN_TOUCH - 8 },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
