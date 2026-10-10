import { defineConfig, devices } from '@playwright/test';

import { tokens } from './design/tokens';

/**
 * Playwright runs against the EXPORTED web build, never the dev server.
 * See scripts/serve-dist.mjs for why.
 *
 * This tier verifies the four things nothing else can:
 *   1. the build boots at all (a blank page is a bundling failure)
 *   2. the public numeral actually fills the stage — a measurement, and the
 *      constraint the whole cross-check rests on (F-9.7)
 *   3. real pointer press-and-hold, which is the only place the react-native-web
 *      pointer path gets exercised
 *   4. orientation (S19): a phone in portrait past two digits should show the
 *      rotate hint instead of silently under-sizing the count; a tablet in
 *      portrait should not need it at all
 *
 * Screenshots here are evidence for a human plus a handful of computed geometry
 * assertions. Pixel-diff comparison is deliberately not used: font rendering
 * differs between a developer's macOS and CI's Linux runner, and the resulting
 * golden-file churn would cost more than it catches.
 *
 * Orientation projects only run `orientation.spec.ts`, not the whole suite.
 * The interaction tests (holds, phantom-count guards, undo, ...) exercise JS
 * event handling that doesn't depend on viewport dimensions; re-running all of
 * them at every screen size would be bulk, not additional signal. Only what
 * genuinely depends on viewport — layout and the numeral's measured size —
 * gets its own viewport-specific test. Tablet landscape has no project of its
 * own: it shares the phone landscape layout (nothing in it is viewport-driven
 * in a way orientation could break), so it is asserted, not separately tested.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'node scripts/serve-dist.mjs',
    url: 'http://127.0.0.1:8080',
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
      testMatch: /(orientation|v2-money)\.spec\.ts/,
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
