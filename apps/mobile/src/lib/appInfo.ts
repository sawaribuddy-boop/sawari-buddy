// Support contacts, legal links and the app version shown on the Profile screens.

import Constants from 'expo-constants';
import { Alert, Linking } from 'react-native';

export const SUPPORT_PHONE = '+918569864161';
export const SUPPORT_PHONE_DISPLAY = '+91 85698 64161';
export const SUPPORT_EMAIL = 'sawaribuddy@gmail.com';

// Pages to be published on sawaribuddy.in (website repo).
export const TERMS_URL = 'https://sawaribuddy.in/terms';
export const PRIVACY_URL = 'https://sawaribuddy.in/privacy';

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/**
 * Open a tel:, mailto: or web link. A device can lack the app for it (no Mail account on an
 * iPhone, an iPad or simulator without calling), so on failure show the text to copy instead.
 * Uses openURL directly: canOpenURL on iOS needs every scheme declared in Info.plist.
 */
export async function openExternal(url: string, fallback: { title: string; text: string }): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(fallback.title, fallback.text);
  }
}

export function callSupport() {
  void openExternal(`tel:${SUPPORT_PHONE}`, { title: 'Call SawariBuddy support', text: SUPPORT_PHONE_DISPLAY });
}

export function whatsappSupport() {
  void openExternal(`https://wa.me/${SUPPORT_PHONE.replace('+', '')}`, {
    title: 'WhatsApp SawariBuddy support',
    text: SUPPORT_PHONE_DISPLAY,
  });
}

export function emailSupport(subject = 'SawariBuddy support') {
  void openExternal(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`, {
    title: 'Email SawariBuddy support',
    text: SUPPORT_EMAIL,
  });
}
