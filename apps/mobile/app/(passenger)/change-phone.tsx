import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { VerifyPhoneForm } from '@/features/auth/VerifyPhoneForm';
import { spacing } from '@/theme';

export default function PassengerChangePhoneScreen() {
  const router = useRouter();
  const { account } = useAuth();
  return (
    <Screen scroll keyboardAvoiding edges={['top']}>
      <View style={styles.body}>
        <Button label="Back" variant="ghost" icon="arrow-left" fullWidth={false} size="md" onPress={() => router.back()} />
        <AppText variant="title">{account?.phoneVerified ? 'Change mobile number' : 'Verify mobile number'}</AppText>
        <VerifyPhoneForm initialPhone={account?.phoneVerified ? null : account?.phone} onVerified={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
});
