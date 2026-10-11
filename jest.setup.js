/* global jest, beforeEach */
// Testing Library v13 ships its jest matchers built in — there is no
// `extend-expect` entry point to require any more.

// jest-expo's automatic native-module mock makes expo-crypto's
// getRandomValues a no-op, so every UUIDv7 minted in one millisecond would be
// identical. Back it with Node's own CSPRNG — the same source Vitest uses.
jest.mock('expo-crypto', () => ({
  getRandomValues: (array) => globalThis.crypto.getRandomValues(array),
}));

// E02-S01/S02: nothing is recorded without a signed-in user in an open farm
// group, so component tests that write start from one. A test about the gate
// itself clears it (setSessionUser(null) / setSessionGroup(null)).
// Set once up front (a suite's `beforeAll` seeds data) and again before each test.
const session = require('./src/store/session');
const signInForTests = () => {
  session.setSessionUser('test-user');
  session.setSessionGroup('group-1');
};
signInForTests();
beforeEach(signInForTests);
