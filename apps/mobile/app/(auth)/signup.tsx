import { fieldErrors, MIN_PASSWORD_LENGTH, signUpInput } from '@sawari/validation';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Screen, TextField } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { envResult } from '@/lib/env';
import { colors, spacing } from '@/theme';

// Passenger sign-up. The account role is always PASSENGER (set by the database trigger);
// driver accounts are created by SawariBuddy.
export default function SignupScreen() {
  const { t } = useTranslation();
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
      footer={<Button label={t('signup.createButton')} loading={submitting} onPress={() => void submit()} disabled={!envResult.ok || checkEmail} />}
    >
      <View style={styles.body}>
        <View style={styles.header}>
          <AppText variant="title">{t('signup.title')}</AppText>
          <AppText color={colors.ink500}>{t('signup.subtitle')}</AppText>
        </View>

        {!envResult.ok ? (
          <Banner tone="danger" title="App is not configured" message="Run `pnpm mobile:env` on the Mac and restart `pnpm mobile`." />
        ) : null}
        {formError ? <Banner tone="danger" title={t('signup.couldntCreate')} message={formError} /> : null}
        {checkEmail ? <Banner tone="success" title={t('signup.checkEmail')} message={t('signup.checkEmailMessage')} /> : null}

        <TextField
          label={t('signup.fullName')}
          value={fullName}
          onChangeText={setFullName}
          error={errors.fullName}
          placeholder={t('signup.fullNamePlaceholder')}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
        />
        <TextField
          label={t('signup.email')}
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder={t('signup.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <TextField
          label={t('signup.password')}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          hint={t('signup.passwordHint', { min: MIN_PASSWORD_LENGTH })}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />

        <AppText variant="caption" color={colors.ink500}>
          {t('signup.passengerNote')}
        </AppText>

        <Pressable accessibilityRole="link" onPress={() => router.replace('/login')} hitSlop={8}>
          <AppText variant="small" color={colors.ink500} align="center">
            {t('signup.alreadyHaveAccount')}{' '}
            <AppText variant="small" color={colors.green700} style={styles.link}>
              {t('signup.logIn')}
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
