import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { getLocales } from 'expo-localization';

import en from './locales/en';
import hi from './locales/hi';

const LANGUAGE_KEY = 'sawari.language';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

async function getStoredLanguage(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

function getDeviceLanguage(): string {
  const locales = getLocales();
  const deviceLang = locales[0]?.languageCode ?? 'en';
  return SUPPORTED_LANGUAGES.some((l) => l.code === deviceLang) ? deviceLang : 'en';
}

export async function setLanguage(code: LanguageCode): Promise<void> {
  await SecureStore.setItemAsync(LANGUAGE_KEY, code);
  await i18n.changeLanguage(code);
}

let initPromise: Promise<void> | null = null;

export function initI18n(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (i18n.isInitialized) return;
    const stored = await getStoredLanguage();
    const lng = stored ?? getDeviceLanguage();

    await i18n.use(initReactI18next).init({
      resources: { en: { translation: en }, hi: { translation: hi } },
      lng,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });
  })();
  return initPromise;
}

export default i18n;
