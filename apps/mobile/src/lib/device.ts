import { getAndroidId, getIosIdForVendorAsync } from 'expo-application';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { Platform } from 'react-native';

/**
 * A SHA-256 hash of this device's ID, sent at sign-up so one device creates one account
 * (see 20261016000400_phone_and_device). Only the hash leaves the phone.
 *
 * Android: ANDROID_ID, which survives reinstalling the app (it changes on factory reset).
 * iOS: identifierForVendor, which resets when every app from this developer is uninstalled.
 * Returns null where no ID is available (web, or an iOS device that has not unlocked yet).
 */
export async function deviceIdHash(): Promise<string | null> {
  let raw: string | null = null;
  try {
    if (Platform.OS === 'android') raw = getAndroidId();
    else if (Platform.OS === 'ios') raw = await getIosIdForVendorAsync();
  } catch {
    raw = null;
  }
  if (!raw) return null;
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, `${Platform.OS}:${raw}`);
}
