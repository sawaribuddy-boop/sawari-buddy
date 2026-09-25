import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components';
import { colors, spacing } from '@/theme';

export default function NotFoundScreen() {
  return (
    <Screen>
      <View style={styles.body}>
        <AppText variant="title">Page not found</AppText>
        <AppText color={colors.ink500}>This screen does not exist.</AppText>
        <Button label="Go to start" onPress={() => router.replace('/welcome')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: spacing.lg },
});
