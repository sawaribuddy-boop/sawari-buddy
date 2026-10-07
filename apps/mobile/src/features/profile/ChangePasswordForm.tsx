import { changePasswordInput, fieldErrors, MIN_PASSWORD_LENGTH } from '@sawari/validation';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Banner, Button, TextField } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { spacing } from '@/theme';

export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setFormError(null);
    const parsed = changePasswordInput.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSaving(true);
    const { error } = await changePassword(parsed.data.currentPassword, parsed.data.newPassword);
    setSaving(false);
    if (error) {
      setFormError(error);
      return;
    }
    Alert.alert('Password changed', 'Use your new password next time you log in.');
    onDone();
  }

  return (
    <View style={styles.body}>
      {formError ? <Banner tone="danger" title="Couldn't change your password" message={formError} /> : null}
      <TextField
        label="Current password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        error={errors.currentPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
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
        onSubmitEditing={() => void submit()}
      />
      <Button label="Change password" icon="lock-reset" loading={saving} onPress={() => void submit()} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
});
