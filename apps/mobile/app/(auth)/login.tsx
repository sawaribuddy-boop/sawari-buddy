import { fieldErrors, signInInput } from '@sawari/validation';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Screen, TextField } from '@/components';
import { BLOCK_MESSAGES } from '@/features/auth/account';
import { useAuth } from '@/features/auth/AuthProvider';
import { envResult } from '@/lib/env';
import { colors, spacing } from '@/theme';

// Seeded LOCAL accounts (supabase/seed/seed.sql). Development builds only.
const DEV_ACCOUNTS = [
  { label: 'Passenger · Priya', email: 'priya@sawaribuddy.local' },
  { label: 'Driver · Raj', email: 'raj.kumar@sawaribuddy.local' },
] as const;
const DEV_PASSWORD = 'SawariDev#2026';

export default function LoginScreen() {
  const { signIn, notice, clearNotice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setFormError(null);
    const parsed = signInInput.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { error } = await signIn(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    // On success the navigator moves on automatically (the auth guard turns off).
    if (error) setFormError(error);
  }

  const blocked = notice ? BLOCK_MESSAGES[notice] : null;

  return (
    <Screen
      scroll
      keyboardAvoiding
      edges={['bottom']}
      footer={<Button label="Log in" loading={submitting} onPress={() => void submit()} disabled={!envResult.ok} />}
    >
      <View style={styles.body}>
        <View style={styles.header}>
          <AppText variant="title">Log in</AppText>
          <AppText color={colors.ink500}>Passengers and drivers sign in here.</AppText>
        </View>

        {!envResult.ok ? (
          <Banner tone="danger" title="App is not configured" message="Run `pnpm mobile:env` on the Mac and restart `pnpm mobile`." />
        ) : null}
        {blocked ? <Banner tone="danger" title={blocked.title} message={blocked.message} /> : null}
        {formError ? <Banner tone="danger" title="Couldn't log in" message={formError} /> : null}

        <TextField
          label="Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (notice) clearNotice();
          }}
          error={errors.email}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />

        <Pressable accessibilityRole="link" onPress={() => router.replace('/signup')} hitSlop={8}>
          <AppText variant="small" color={colors.ink500} align="center">
            New to SawariBuddy?{' '}
            <AppText variant="small" color={colors.green700} style={styles.link}>
              Create an account
            </AppText>
          </AppText>
        </Pressable>

        {__DEV__ ? (
          <View style={styles.dev}>
            <AppText variant="caption" color={colors.ink500}>
              LOCAL TEST ACCOUNTS (development only)
            </AppText>
            <View style={styles.devRow}>
              {DEV_ACCOUNTS.map((a) => (
                <Button
                  key={a.email}
                  label={a.label}
                  variant="secondary"
                  size="md"
                  fullWidth={false}
                  onPress={() => {
                    setEmail(a.email);
                    setPassword(DEV_PASSWORD);
                    setErrors({});
                    setFormError(null);
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  header: { gap: spacing.xs },
  link: { fontWeight: '700' },
  dev: { marginTop: spacing.lg, gap: spacing.sm, padding: spacing.md, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.ink300 },
  devRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
