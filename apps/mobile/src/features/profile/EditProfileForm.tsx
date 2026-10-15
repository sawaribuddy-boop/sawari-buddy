import { formatPhone } from '@sawari/domain';
import { editProfileInput, fieldErrors } from '@sawari/validation';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, TextField } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, spacing } from '@/theme';

import { updateProfileErrorMessage } from './profileErrors';
import { useUpdateProfile } from './useUpdateProfile';

/** Name is edited here; the mobile number is changed by verifying a new one (`changePhoneHref`). */
export function EditProfileForm({ onDone, changePhoneHref }: { onDone: () => void; changePhoneHref: Href }) {
  const router = useRouter();
  const { account } = useAuth();
  const [fullName, setFullName] = useState(account?.fullName ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useUpdateProfile();

  function submit() {
    const parsed = editProfileInput.safeParse({ fullName });
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
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View style={styles.readOnly}>
        <AppText variant="small" color={colors.ink700}>
          Mobile number
        </AppText>
        <View style={styles.phoneRow}>
          <AppText variant="body" color={colors.ink500} style={styles.flex}>
            {account?.phone ? formatPhone(account.phone) : 'Not added'}
            {account?.phone && !account.phoneVerified ? ' (not verified)' : ''}
          </AppText>
          <Button
            label={account?.phoneVerified ? 'Change' : 'Verify'}
            variant="secondary"
            size="md"
            fullWidth={false}
            onPress={() => router.push(changePhoneHref)}
          />
        </View>
        <AppText variant="caption" color={colors.ink400}>
          A new number is confirmed with an SMS code.
        </AppText>
      </View>
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
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
