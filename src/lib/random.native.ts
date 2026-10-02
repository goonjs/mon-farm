/**
 * Cryptographically secure random bytes — iOS/Android.
 *
 * Hermes has no global `crypto`, so this comes from expo-crypto (first-party,
 * approved through the dependency gate for E01-S02), which reads the
 * platform's secure generator. Same contract as `random.ts`: no fallback.
 */
import { getRandomValues } from 'expo-crypto';

export function randomBytes(n: number): Uint8Array {
  return getRandomValues(new Uint8Array(n));
}
