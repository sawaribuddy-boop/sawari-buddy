import { editProfileInput, fieldErrors } from '@sawari/validation';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, TextField } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, spacing } from '@/theme';

import { formatPhone } from './ProfileView';
import { updateProfileErrorMessage } from './profileErrors';
import { useUpdateProfile } from './useUpdateProfile';

export function EditProfileForm({ onDone }: { onDone: () => void }) {
  const { account } = useAuth();
  const [fullName, setFullName] = useState(account?.fullName ?? '');
  const [phone, setPhone] = useState(account?.phone ? formatPhone(account.phone) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useUpdateProfile();

  function submit() {
    const parsed = editProfileInput.safeParse({ fullName, phone });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data, { onSuccess: onDone });
  }

  return (
    <View style={styles.body}>
      {mutation.isError ? <Banner tone="danger" title={updateProfileErrorMessage(mutation.error)} /> : null}
      <TextField
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        error={errors.fullName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
      />
      <TextField
        label="Mobile number"
        value={phone}
        onChangeText={setPhone}
        error={errors.phone}
        hint="Optional. Drivers and support can use it to reach you about a ride."
        placeholder="98765 43210"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="done"
      />
      <View style={styles.readOnly}>
        <AppText variant="small" color={colors.ink700}>
          Email
        </AppText>
        <AppText variant="body" color={colors.ink500}>
          {account?.email ?? '—'}
        </AppText>
        <AppText variant="caption" color={colors.ink400}>
          To change your email, contact support.
        </AppText>
      </View>
      <Button label="Save changes" icon="content-save-outline" loading={mutation.isPending} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  readOnly: { gap: spacing.xxs },
});
