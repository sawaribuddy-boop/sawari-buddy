import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components';
import { EditProfileForm } from '@/features/profile';
import { spacing } from '@/theme';

export default function PassengerEditProfileScreen() {
  const router = useRouter();
  return (
    <Screen scroll keyboardAvoiding edges={['top']}>
      <View style={styles.body}>
        <Button label="Back" variant="ghost" icon="arrow-left" fullWidth={false} size="md" onPress={() => router.back()} />
        <AppText variant="title">Edit profile</AppText>
        <EditProfileForm onDone={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
});
