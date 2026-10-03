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
