import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { setLanguage, SUPPORTED_LANGUAGES, type LanguageCode } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

export function LanguagePicker() {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language;

  return (
    <View style={styles.container}>
      <AppText variant="bodyStrong" style={styles.label}>{t('common.language')}</AppText>
      <View style={styles.options}>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isActive = currentLang === lang.code;
          return (
            <Pressable
              key={lang.code}
              style={[styles.option, isActive && styles.optionActive]}
              onPress={() => void setLanguage(lang.code as LanguageCode)}
            >
              <Icon
                name={isActive ? 'radiobox-marked' : 'radiobox-blank'}
                size={20}
                color={isActive ? colors.green600 : colors.ink400}
              />
              <AppText
                variant="body"
                color={isActive ? colors.green700 : colors.ink700}
              >
                {lang.nativeLabel}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    marginBottom: spacing.xs,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  optionActive: {
    borderColor: colors.green600,
    backgroundColor: colors.green50,
  },
});
