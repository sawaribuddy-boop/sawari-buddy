import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export interface ToastMessage {
  id: string;
  text: string;
  icon?: IconName;
}

interface ToastProps {
  message: ToastMessage | null;
  duration?: number;
  onDismiss: () => void;
}

export function Toast({ message, duration = 3500, onDismiss }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-40)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    AccessibilityInfo.announceForAccessibility(message.text);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -40, duration: 200, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }, duration);

    return () => clearTimeout(timer);
  }, [message?.id]);

  if (!message) return null;

  return (
    <Animated.View
      style={[styles.container, { top: insets.top + spacing.sm, opacity, transform: [{ translateY }] }]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.content}>
        {message.icon ? <Icon name={message.icon} size={20} color={colors.white} /> : null}
        <AppText variant="body" color={colors.white} style={styles.text}>
          {message.text}
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 999,
    ...shadow.card,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.green900,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  text: { flex: 1 },
});
