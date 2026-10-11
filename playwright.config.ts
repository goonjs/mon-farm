import { defineConfig, devices } from '@playwright/test';

import { tokens } from './design/tokens';
import { BASE_URL, signedIn } from './e2e/session';

/**
 * Playwright runs against the EXPORTED web build, never the dev server.
 * See scripts/serve-dist.mjs for why.
 *
 * This tier verifies what nothing else can: the build boots at all (a blank
 * page is a bundling failure), the v2 screens work end to end in a real
 * browser — offline, from the local event log, across a reload — and real
 * pointer and keyboard input (typing key by key, focus) on react-native-web.
 *
 * The v2 specs are portrait-first and run in `phone-portrait`. The landscape
 * projects match every spec but each v2 spec skips itself there, and
 * `tablet-portrait` matches only `orientation.spec.ts`, which no longer
 * exists — both are kept, untouched, until landscape and tablet layouts are
 * decided.
 *
 * Screenshots are evidence for a human, not goldens: font rendering differs
 * between machines, so there is no pixel diff. The specs write them into
 * docs/ only when UPDATE_SCREENSHOTS=1 (see docs/ui-v2.md and `evidence` in
 * e2e/fixtures.ts).
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    // E02-S01: the app opens on the sign-in screen until someone has signed
    // in; the suites start from a device that already has, in a group
    // (e2e/session.ts).
    storageState: signedIn,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'node scripts/serve-dist.mjs',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  projects: [
    {
      // Modern 6.1" phone, landscape.
      name: 'phone-landscape',
      use: { ...devices['Pixel 7 landscape'], viewport: { width: 844, height: 390 } },
    },
    {
      // The NFR-4 low-end Android floor. Layout must hold here too, and it is
      // the binding case for numeral height — fixed chrome is a larger fraction
      // of 360px than of 390px.
      name: 'phone-landscape-floor',
      use: {
        ...devices['Pixel 7 landscape'],
        viewport: { width: 740, height: 360 },
        deviceScaleFactor: 2,
      },
    },
    {
      // Same phone, portrait — the binding case for the rotate hint.
      name: 'phone-portrait',
      testMatch: /(orientation|v2-money|v2-farm|v2-store|v2-home|v2-sale|v2-sale-short|v2-account|auth-emulator|sync-emulator|sync-wizard)\.spec\.ts/,
      use: { ...devices['Pixel 7'], viewport: tokens.viewport.portrait, isMobile: true, hasTouch: true },
    },
    {
      // ~10.9" tablet, portrait — should clear the numeral floor unaided.
      name: 'tablet-portrait',
      testMatch: /orientation\.spec\.ts/,
      use: {
        viewport: tokens.viewport.tabletPortrait,
        isMobile: true,
        hasTouch: true,
        defaultBrowserType: 'chromium',
      },
    },
  ],
});
