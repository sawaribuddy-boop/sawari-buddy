import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Banner, BrandMark, Button, Screen } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { homeHref } from '@/features/auth/routing';
import { colors, spacing } from '@/theme';

// Entry route: shows the loading / error state while the session and account resolve, then
// sends the user to Welcome (or Log in with a notice), the passenger home, or the driver home.
export default function Index() {
  const { t } = useTranslation();
  const { status, account, notice, errorMessage, retry, signOut } = useAuth();
  const href = homeHref({ status, role: account?.role ?? null, hasNotice: notice !== null });

  if (href) return <Redirect href={href} />;

  if (status === 'error') {
    return (
      <Screen footer={<Button label={t('common.signOut')} variant="ghost" onPress={() => void signOut()} />}>
        <View style={styles.center}>
          <BrandMark />
          <Banner
            tone="warning"
            title={t('common.cantReachTitle')}
            message={errorMessage ?? t('common.cantReachMessage')}
          />
          <Button label={t('common.tryAgain')} onPress={() => void retry()} />
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
        {t('common.loading')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl, backgroundColor: colors.green900 },
  center: { flex: 1, justifyContent: 'center', gap: spacing.xl },
});
