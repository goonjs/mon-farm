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
    // `src/store/*.test.ts` (not `**`) is deliberate: it picks up the pure
    // port files (people.ts, store.ts — no RN/web-only globals) but never the
    // platform adapters (people.web.ts, people.native.ts, ...), which touch
    // localStorage / expo-sqlite and belong to the component or e2e tier.
    // `src/i18n/*.test.ts` joins on the same terms: the catalogue and its
    // resolver are plain data and a pure function, with the React binding kept
    // in a separate file precisely so the rules can be proven without a tree.
    // `src/speech/*.test.ts` (S10) is the port and the announcer — pure, no RN
    // import — never the `speaker.web.ts` / `speaker.native.ts` adapters,
    // which belong to the component/e2e tier exactly as `store.web.ts` /
    // `store.native.ts` do.
    include: ['scripts/*.test.ts', 'src/lib/*.test.ts', 'src/core/**/*.test.ts', 'src/store/*.test.ts', 'src/i18n/*.test.ts', 'src/speech/*.test.ts'],
    environment: 'node',
    globals: false,
    coverage: {
      include: ['src/core/**/*.ts', 'src/store/*.ts', 'src/speech/*.ts'],
      exclude: [
        'src/core/**/*.test.ts',
        'src/core/fixtures.ts',
        'src/store/*.test.ts',
        'src/speech/*.test.ts',
      ],
    },
  },
});
