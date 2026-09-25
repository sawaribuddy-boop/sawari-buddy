import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, typography, type TypographyVariant } from '@/theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export function AppText({ variant = 'body', color = colors.ink900, align, style, ...rest }: AppTextProps) {
  return <Text {...rest} style={[typography[variant], { color }, align && { textAlign: align }, styles.base, style]} />;
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
});
