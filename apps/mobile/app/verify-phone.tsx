import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Screen } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { VerifyPhoneForm } from '@/features/auth/VerifyPhoneForm';
import { colors, spacing } from '@/theme';

/**
 * Shown after sign-in until the account has a verified mobile number (when
 * platform_settings.phone_verification_required is on). Verifying opens the app.
 */
export default function VerifyPhoneScreen() {
  const { account, signOut } = useAuth();
  return (
    <Screen scroll keyboardAvoiding edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.header}>
          <AppText variant="title">Verify your mobile number</AppText>
          <AppText color={colors.ink500}>
            Each SawariBuddy account has its own mobile number. Drivers and support use it to reach you about a ride.
          </AppText>
        </View>
        <VerifyPhoneForm initialPhone={account?.signupPhone ?? account?.phone} />
        <Pressable accessibilityRole="button" onPress={() => void signOut()} hitSlop={8}>
          <AppText variant="small" color={colors.ink500} align="center">
            Not you? <AppText variant="small" color={colors.green700} style={styles.link}>Sign out</AppText>
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl },
  header: { gap: spacing.xs },
  link: { fontWeight: '700' },
});
