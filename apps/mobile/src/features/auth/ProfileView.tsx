import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, StatusPill } from '@/components';
import { colors, radius, spacing } from '@/theme';

import { useAuth } from './AuthProvider';

const ROLE_LABEL = { PASSENGER: 'Passenger', DRIVER: 'Driver' } as const;

/** Shared profile card + sign out (passenger and driver profile screens). */
export function ProfileView() {
  const { t } = useTranslation();
  const { account, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  if (!account) return null;

  function confirmSignOut() {
    Alert.alert(t('common.signOutTitle'), t('common.signOutMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.signOut'),
        style: 'destructive',
        onPress: () => {
          setSigningOut(true);
          void signOut().finally(() => setSigningOut(false));
        },
      },
    ]);
  }

  return (
    <View style={styles.stack}>
      <Card>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Icon name="account" size={30} color={colors.green700} />
          </View>
          <View style={styles.flex}>
            <AppText variant="heading">{account.fullName}</AppText>
            {account.email ? (
              <AppText variant="small" color={colors.ink500}>
                {account.email}
              </AppText>
            ) : null}
          </View>
          <StatusPill label={ROLE_LABEL[account.role]} tone={account.role === 'DRIVER' ? 'info' : 'success'} />
        </View>
      </Card>
      <Button label={t('common.signOut')} variant="dangerSoft" icon="logout" loading={signingOut} onPress={confirmSignOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: spacing.xxs },
});
