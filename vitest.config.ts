import { defineConfig } from 'vitest/config';

/**
 * Vitest owns `src/core/**` and nothing else.
 *
 * `core/` imports nothing from react, react-native or expo, so it needs no
 * Babel or Metro transform. Running it under jest-expo instead would drag
 * `transformIgnorePatterns` and node_modules ESM interop — the most fragile
 * part of the JS tooling — into the tightest feedback loop in the project.
 *
 * The split means the money model gets sub-second feedback, and any tooling
 * flakiness is confined to the smaller component suite (see jest.config.js).
 */
export default defineConfig({
  test: {
    include: ['src/core/**/*.test.ts'],
    environment: 'node',
    globals: false,
    coverage: {
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/*.test.ts', 'src/core/fixtures.ts'],
    },
  },
});
