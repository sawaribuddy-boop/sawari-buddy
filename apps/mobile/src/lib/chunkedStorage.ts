// Chunked key-value storage for Supabase sessions (pure logic; see secureStorage.ts for the OS backend).
// SecureStore values should stay under ~2 KB, and a session can be larger, so values are split:
//   <key>.n = number of chunks, <key>.0 … <key>.(n-1) = chunk contents.

/** Minimal async key-value backend (SecureStore in the app, a Map in tests). */
export interface KeyValueBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

/** The storage interface supabase-js expects. */
export interface SupportedStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const CHUNK_SIZE = 1800;

// SecureStore keys may only contain alphanumerics, ".", "-" and "_".
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export function createChunkedStorage(backend: KeyValueBackend, chunkSize = CHUNK_SIZE): SupportedStorage {
  async function chunkCount(key: string): Promise<number> {
    const raw = await backend.getItem(`${key}.n`);
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  async function removeChunks(key: string, from: number, to: number) {
    for (let i = from; i < to; i++) await backend.deleteItem(`${key}.${i}`);
  }

  return {
    async getItem(rawKey) {
      const key = safeKey(rawKey);
      const n = await chunkCount(key);
      if (n === 0) return null;
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const part = await backend.getItem(`${key}.${i}`);
        if (part === null) return null; // incomplete write: treat as no session
        parts.push(part);
      }
      return parts.join('');
    },

    async setItem(rawKey, value) {
      const key = safeKey(rawKey);
      const previous = await chunkCount(key);
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += chunkSize) chunks.push(value.slice(i, i + chunkSize));
      if (chunks.length === 0) chunks.push('');
      for (let i = 0; i < chunks.length; i++) await backend.setItem(`${key}.${i}`, chunks[i] ?? '');
      await backend.setItem(`${key}.n`, String(chunks.length));
      await removeChunks(key, chunks.length, previous); // drop leftovers from a longer previous value
    },

    async removeItem(rawKey) {
      const key = safeKey(rawKey);
      const n = await chunkCount(key);
      await backend.deleteItem(`${key}.n`);
      await removeChunks(key, 0, n);
    },
  };
}
