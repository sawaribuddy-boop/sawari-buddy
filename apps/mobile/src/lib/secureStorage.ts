// Encrypted session storage (Phase 2 decision D4).
//
// The Supabase session (access + refresh token) is stored ONLY in the OS secure store:
// iOS Keychain / Android Keystore-backed encryption, via expo-secure-store, chunked by
// createChunkedStorage. Nothing is written to unencrypted AsyncStorage.

import * as SecureStore from 'expo-secure-store';

import { createChunkedStorage, type KeyValueBackend, type SupportedStorage } from './chunkedStorage';

const secureStoreBackend: KeyValueBackend = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
};

export const secureSessionStorage: SupportedStorage = createChunkedStorage(secureStoreBackend);
