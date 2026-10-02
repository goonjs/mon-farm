/* global jest */
// Testing Library v13 ships its jest matchers built in — there is no
// `extend-expect` entry point to require any more.

// jest-expo's automatic native-module mock makes expo-crypto's
// getRandomValues a no-op, so every UUIDv7 minted in one millisecond would be
// identical. Back it with Node's own CSPRNG — the same source Vitest uses.
jest.mock('expo-crypto', () => ({
  getRandomValues: (array) => globalThis.crypto.getRandomValues(array),
}));
