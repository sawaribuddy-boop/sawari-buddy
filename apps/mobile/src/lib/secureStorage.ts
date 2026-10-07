// Encrypted session storage (Phase 2 decision D4).
//
// The Supabase session (access + refresh token) is stored ONLY in the OS secure store:
// iOS Keychain / Android Keystore-backed encryption, via expo-secure-store, chunked by
// createChunkedStorage. Nothing is written to unencrypted AsyncStorage.

import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { createChunkedStorage, type KeyValueBackend, type SupportedStorage } from './chunkedStorage';

const secureStoreBackend: KeyValueBackend = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
};

const chunked = createChunkedStorage(secureStoreBackend);

// The iOS Keychain outlives the app, so after a delete and reinstall the old session would sign the
// user straight back in. The documents folder is removed with the app: a missing marker file means a
// fresh install, and any session found then is left over from the previous install.
const INSTALL_MARKER = 'sawari-installed';

function detectFreshInstall(): boolean {
  try {
    const marker = new File(Paths.document, INSTALL_MARKER);
    if (marker.exists) return false;
    marker.create();
    marker.write('1');
    return true;
  } catch {
    return false; // can't tell: keep the session rather than sign the user out
  }
}

const freshInstall = detectFreshInstall();
const checkedKeys = new Set<string>();

export const secureSessionStorage: SupportedStorage = {
  async getItem(key) {
    if (freshInstall && !checkedKeys.has(key)) {
      checkedKeys.add(key);
      await chunked.removeItem(key);
      return null;
    }
    return chunked.getItem(key);
  },
  async setItem(key, value) {
    checkedKeys.add(key);
    await chunked.setItem(key, value);
  },
  removeItem: (key) => chunked.removeItem(key),
};
