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

// E01-S19: Jest runs as native (jest-expo), so a bare `device-settings` import
// resolves to the expo-sqlite adapter, whose native module does not exist
// here. Back it with the web adapter over the localStorage stub each suite
// sets up, but keep native's `readDuringRender` so providers behave as on a
// phone. The native adapter itself is tested in Vitest with kv-store faked
// (src/store/device-settings.native.test.ts).
jest.mock('./src/store/device-settings', () => ({
  deviceSettings: {
    ...jest.requireActual('./src/store/device-settings.web').deviceSettings,
    readDuringRender: true,
  },
}));
