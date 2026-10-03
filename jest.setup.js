// Testing Library v13 ships its jest matchers built in — there is no
// `extend-expect` entry point to require any more.

/* global jest */
// The icon font loads asynchronously and re-renders after the test has moved
// on (act() warnings). Its glyphs are not what component tests assert on, so
// render the icon's name as plain text instead.
jest.mock('@expo/vector-icons/Feather', () => {
  const { Text } = require('react-native');
  const Feather = ({ name }) => require('react').createElement(Text, null, name);
  return { __esModule: true, default: Feather };
});

// jest-expo's automatic native-module mock makes expo-crypto's
// getRandomValues a no-op, so every UUIDv7 minted in one millisecond would be
// identical. Back it with Node's own CSPRNG — the same source Vitest uses.
jest.mock('expo-crypto', () => ({
  getRandomValues: (array) => globalThis.crypto.getRandomValues(array),
}));
