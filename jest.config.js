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
  // CI runs without a transform cache, so a suite's first test pays for
  // transforming everything it renders. v2-sale-weigh's first test measured
  // 4.95 s on dev with `--no-cache --maxWorkers=2` (CI's shape) — on the edge
  // of jest's 5 s default — and it timed out on CI once more suites were added
  // (E03-S10, 2026-11-02), failing the whole file in a cascade. 20 s keeps a
  // real hang failing, without a cold first test doing so.
  testTimeout: 20_000,
  // The classic RN tooling sink. Expo and RN ship untranspiled ESM, so these
  // packages must go through Babel rather than being skipped as node_modules.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-css-interop)',
  ],
  // Order matters — the first matching pattern wins. The stylesheet stub goes
  // first so `@/global.css` is stubbed rather than resolved through `@/`.
  moduleNameMapper: {
    '\\.css$': '<rootDir>/jest.style-mock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
