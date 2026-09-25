import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Screen } from '@/components';
import { colors, spacing } from '@/theme';

// Shell only. Passenger sign-up (Supabase Auth; profile created by the database trigger) is Phase 2 Step 3.
export default function SignupScreen() {
  return (
    <Screen edges={['bottom']} footer={<Button label="Back to welcome" variant="secondary" onPress={() => router.back()} />}>
      <View style={styles.body}>
        <AppText variant="title">Create your account</AppText>
        <AppText color={colors.ink500}>Book a seat in a shared auto, quickly and easily.</AppText>
        <Banner tone="info" title="Not available yet" message="Sign-up is being built in the next steps of Phase 2." />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
});
