import { fieldErrors, MIN_PASSWORD_LENGTH, signUpInput } from '@sawari/validation';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Screen, TextField } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { envResult } from '@/lib/env';
import { colors, spacing } from '@/theme';

// Passenger sign-up. The account role is always PASSENGER (set by the database trigger);
// driver accounts are created by SawariBuddy.
export default function SignupScreen() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setFormError(null);
    const parsed = signUpInput.safeParse({ fullName, email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { error, needsConfirmation } = await signUp(parsed.data.fullName, parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (error) setFormError(error);
    else if (needsConfirmation) setCheckEmail(true); // hosted projects with email confirmation enabled
    // Otherwise the new session routes straight to the passenger home.
  }

  return (
    <Screen
      scroll
      keyboardAvoiding
      edges={['bottom']}
      footer={<Button label="Create account" loading={submitting} onPress={() => void submit()} disabled={!envResult.ok || checkEmail} />}
    >
      <View style={styles.body}>
        <View style={styles.header}>
          <AppText variant="title">Create your account</AppText>
          <AppText color={colors.ink500}>Book a seat in a shared auto, quickly and easily.</AppText>
        </View>

        {!envResult.ok ? (
          <Banner tone="danger" title="App is not configured" message="Run `pnpm mobile:env` on the Mac and restart `pnpm mobile`." />
        ) : null}
        {formError ? <Banner tone="danger" title="Couldn't create your account" message={formError} /> : null}
        {checkEmail ? <Banner tone="success" title="Check your email" message="Confirm your email address, then log in." /> : null}

        <TextField
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          error={errors.fullName}
          placeholder="Priya Sharma"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />

        <AppText variant="caption" color={colors.ink500}>
          This creates a passenger account. Driver accounts are set up by SawariBuddy.
        </AppText>

        <Pressable accessibilityRole="link" onPress={() => router.replace('/login')} hitSlop={8}>
          <AppText variant="small" color={colors.ink500} align="center">
            Already have an account?{' '}
            <AppText variant="small" color={colors.green700} style={styles.link}>
              Log in
            </AppText>
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  header: { gap: spacing.xs },
  link: { fontWeight: '700' },
});
