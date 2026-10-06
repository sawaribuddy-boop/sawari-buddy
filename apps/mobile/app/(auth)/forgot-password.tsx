import { fieldErrors, MIN_PASSWORD_LENGTH, passwordResetInput, passwordResetRequestInput } from '@sawari/validation';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Screen, TextField } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, spacing } from '@/theme';

/**
 * Two steps on one screen: email → 6-digit code by email (supabase/templates/recovery.html) →
 * code + new password. On success the user is signed in and the navigator moves on.
 */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { requestPasswordReset, resetPassword } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setFormError(null);
    const parsed = passwordResetRequestInput.safeParse({ email });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await requestPasswordReset(parsed.data.email);
    setBusy(false);
    if (error) {
      setFormError(error);
      return;
    }
    setEmail(parsed.data.email);
    setStep('code');
  }

  async function submitReset() {
    setFormError(null);
    const parsed = passwordResetInput.safeParse({ email, code, newPassword });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await resetPassword(parsed.data.email, parsed.data.code, parsed.data.newPassword);
    setBusy(false);
    // On success the auth guard sends the user into the app.
    if (error) setFormError(error);
  }

  return (
    <Screen
      scroll
      keyboardAvoiding
      edges={['bottom']}
      footer={
        step === 'email' ? (
          <Button label="Send code" loading={busy} onPress={() => void sendCode()} />
        ) : (
          <Button label="Set new password" loading={busy} onPress={() => void submitReset()} />
        )
      }
    >
      <View style={styles.body}>
        <View style={styles.header}>
          <AppText variant="title">Reset password</AppText>
          <AppText color={colors.ink500}>
            {step === 'email'
              ? "Enter your account's email. We'll send you a 6-digit code."
              : `If an account exists for ${email}, we've emailed it a 6-digit code. It expires in 1 hour.`}
          </AppText>
        </View>

        {formError ? <Banner tone="danger" title="Couldn't reset your password" message={formError} /> : null}

        {step === 'email' ? (
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
            textContentType="username"
            returnKeyType="send"
            onSubmitEditing={() => void sendCode()}
          />
        ) : (
          <>
            <TextField
              label="6-digit code"
              value={code}
              onChangeText={setCode}
              error={errors.code}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="next"
            />
            <TextField
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              error={errors.newPassword}
              hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={() => void submitReset()}
            />
            <Button
              label="Send a new code"
              variant="ghost"
              size="md"
              disabled={busy}
              onPress={() => {
                setCode('');
                setFormError(null);
                setStep('email');
              }}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  header: { gap: spacing.xs },
});
