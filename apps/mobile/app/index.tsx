import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Banner, BrandMark, Button, Screen } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { homeHref } from '@/features/auth/routing';
import { colors, spacing } from '@/theme';

// Entry route: shows the loading / error state while the session and account resolve, then
// sends the user to Welcome (or Log in with a notice), the passenger home, or the driver home.
export default function Index() {
  const { status, account, notice, errorMessage, retry, signOut } = useAuth();
  const href = homeHref({ status, role: account?.role ?? null, hasNotice: notice !== null });

  if (href) return <Redirect href={href} />;

  if (status === 'error') {
    return (
      <Screen footer={<Button label="Sign out" variant="ghost" onPress={() => void signOut()} />}>
        <View style={styles.center}>
          <BrandMark />
          <Banner
            tone="warning"
            title="Can't reach SawariBuddy"
            message={errorMessage ?? 'Check your connection. You are still signed in.'}
          />
          <Button label="Try again" onPress={() => void retry()} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.loading} accessible accessibilityRole="progressbar" accessibilityLabel="Loading SawariBuddy">
      <StatusBar style="light" />
      <BrandMark size={52} onDark />
      <ActivityIndicator color={colors.autoYellow} size="large" />
      <AppText variant="small" color="rgba(255,255,255,0.75)">
        Loading…
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl, backgroundColor: colors.green900 },
  center: { flex: 1, justifyContent: 'center', gap: spacing.xl },
});
