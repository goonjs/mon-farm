/**
 * Cryptographically secure random bytes — web and Node (Vitest/Jest).
 *
 * Every supported browser and Node 20+ expose `crypto.getRandomValues`. There
 * is deliberately no `Math.random` fallback: a predictable id is a collision
 * waiting to happen across devices, so a missing CSPRNG fails loudly.
 * Native (Hermes has no global `crypto`) resolves `random.native.ts` instead.
 */
export function randomBytes(n: number): Uint8Array {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) {
    throw new Error('No CSPRNG available (crypto.getRandomValues); refusing to mint ids.');
  }
  return c.getRandomValues(new Uint8Array(n));
}
