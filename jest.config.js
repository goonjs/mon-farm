/**
 * jest-expo owns component behaviour: anything that needs a React tree but not
 * a browser. Pure logic lives in Vitest (see vitest.config.ts); layout, sizing
 * and contrast live in Playwright, because Testing Library cannot see pixels
 * and asserting on them here would be theatre.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // The classic RN tooling sink. Expo and RN ship untranspiled ESM, so these
  // packages must go through Babel rather than being skipped as node_modules.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-css-interop)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.css$': '<rootDir>/jest.style-mock.js',
  },
};
