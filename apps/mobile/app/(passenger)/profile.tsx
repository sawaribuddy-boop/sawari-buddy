import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, LanguagePicker, Screen } from '@/components';
import { ProfileView } from '@/features/auth/ProfileView';
import { spacing } from '@/theme';

export default function PassengerProfileScreen() {
  const { t } = useTranslation();
  return (
    <Screen scroll edges={['top']}>
      <View style={styles.body}>
        <AppText variant="title">{t('common.profile')}</AppText>
        <ProfileView />
        <Card>
          <LanguagePicker />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
});
