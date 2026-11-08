import { test as base } from '@playwright/test';

import { preloadAccount, signedIn, type Account } from './session';

export { expect, type Page } from '@playwright/test';

/**
 * The e2e `test`: Playwright's, plus the `account` the device holds when a
 * test starts (default: signed in, one farm group). Set it per file or
 * describe with `test.use({ account: signedOut })`. Specs import `test` and
 * `expect` from here, not from '@playwright/test', so every page gets the
 * account before the app's first script (see `preloadAccount`).
 */
export const test = base.extend<{ account: Account }>({
  account: [signedIn, { option: true }],
  context: async ({ context, account }, provide) => {
    await preloadAccount(context, account);
    await provide(context);
  },
});
