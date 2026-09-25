import { describe, expect, it } from 'vitest';

import { createChunkedStorage, type KeyValueBackend } from './chunkedStorage';

function memoryBackend() {
  const map = new Map<string, string>();
  const backend: KeyValueBackend = {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    deleteItem: async (k) => void map.delete(k),
  };
  return { map, backend };
}

describe('createChunkedStorage', () => {
  it('round-trips values larger than one chunk', async () => {
    const { map, backend } = memoryBackend();
    const storage = createChunkedStorage(backend, 10);
    const value = 'x'.repeat(25);
    await storage.setItem('sawari.auth', value);
    expect(map.get('sawari.auth.n')).toBe('3');
    expect(await storage.getItem('sawari.auth')).toBe(value);
  });

  it('removes leftover chunks when a value shrinks', async () => {
    const { map, backend } = memoryBackend();
    const storage = createChunkedStorage(backend, 10);
    await storage.setItem('k', 'a'.repeat(30));
    await storage.setItem('k', 'b'.repeat(5));
    expect([...map.keys()].sort()).toEqual(['k.0', 'k.n']);
    expect(await storage.getItem('k')).toBe('bbbbb');
  });

  it('removeItem deletes every chunk', async () => {
    const { map, backend } = memoryBackend();
    const storage = createChunkedStorage(backend, 4);
    await storage.setItem('k', 'abcdefghij');
    await storage.removeItem('k');
    expect(map.size).toBe(0);
    expect(await storage.getItem('k')).toBeNull();
  });

  it('treats a partially written value as missing', async () => {
    const { map, backend } = memoryBackend();
    const storage = createChunkedStorage(backend, 4);
    await storage.setItem('k', 'abcdefgh');
    map.delete('k.1');
    expect(await storage.getItem('k')).toBeNull();
  });

  it('sanitises keys to characters SecureStore accepts', async () => {
    const { map, backend } = memoryBackend();
    const storage = createChunkedStorage(backend);
    await storage.setItem('sb-192.168.1.82:55321-auth token', 'v');
    expect([...map.keys()].every((k) => /^[A-Za-z0-9._-]+$/.test(k))).toBe(true);
  });
});
