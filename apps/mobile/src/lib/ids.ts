import { randomUUID } from 'expo-crypto';

/**
 * A fresh idempotency key for booking RPCs (book_seats, add_walk_in). React Native has no global
 * `crypto`, so `crypto.randomUUID()` throws on devices even though it works in Node tests.
 */
export function newIdempotencyKey(): string {
  return randomUUID();
}
