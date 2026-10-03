import { defineConfig } from 'vitest/config';

/**
 * Firestore rules tests (E01-S08). Kept out of vitest.config.ts because they
 * need the emulator: run through `npm run test:rules`, which starts it with
 * `firebase emulators:exec` and points the SDK at it via env vars.
 */
export default defineConfig({
  test: {
    include: ['firestore/*.test.ts'],
    environment: 'node',
    globals: false,
    // One shared emulator database; files must not clear each other's data.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
