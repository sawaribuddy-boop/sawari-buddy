import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Screen } from '@/components';
import { colors, spacing } from '@/theme';

// Shell only. Real email + password sign-in (Supabase Auth, encrypted session) is Phase 2 Step 3.
export default function LoginScreen() {
  return (
    <Screen edges={['bottom']} footer={<Button label="Back to welcome" variant="secondary" onPress={() => router.back()} />}>
      <View style={styles.body}>
        <AppText variant="title">Log in</AppText>
        <AppText color={colors.ink500}>Passengers and drivers sign in here.</AppText>
        <Banner tone="info" title="Not available yet" message="Sign-in is being built in the next steps of Phase 2." />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
});
