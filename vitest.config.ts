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
    // port files (people.ts, store.ts — no RN/web-only globals). The
    // platform adapters tested here are store.web.ts and account.web.ts, and
    // only through an injected IDBFactory (fake-indexeddb) and Storage stub —
    // nothing reaches a real browser global. Native adapters (expo-sqlite)
    // stay out.
    // `src/i18n/*.test.ts` joins on the same terms: the catalogue and its
    // resolver are plain data and a pure function, with the React binding kept
    // in a separate file precisely so the rules can be proven without a tree.
    // `src/speech/*.test.ts` (S10) is the port and the announcer — pure, no RN
    // import — never the `speaker.web.ts` / `speaker.native.ts` adapters,
    // which belong to the component/e2e tier exactly as `store.web.ts` /
    // `store.native.ts` do.
    // `src/auth/*.test.ts` (E02-S01) is the pure sign-in error mapping only;
    // the Firebase adapters (`google.web.ts` / `google.native.ts`) are e2e.
    include: ['scripts/*.test.ts', 'src/lib/*.test.ts', 'src/core/**/*.test.ts', 'src/store/*.test.ts', 'src/i18n/*.test.ts', 'src/speech/*.test.ts', 'src/auth/*.test.ts'],
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
