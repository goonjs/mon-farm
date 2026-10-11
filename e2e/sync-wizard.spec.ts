import { expect, test, type Page } from '@playwright/test';

import { evidence } from './fixtures';
import { signedIn } from './session';

/**
 * E01-S09 review fix: the points wizard waits for the first pull, but never
 * traps the person. On a build with sync running (emulator build, see
 * `sync-emulator.spec.ts`) and a phone that has no Firebase session, the
 * first pull cannot happen: the wizard first says it is waiting, then, after
 * the grace period, says plainly that sync is not available and lets the
 * points be created anyway. Offline says so in its own words.
 *
 * Skipped in the default run: `npm run test:e2e:sync`. Screenshots are written to
 * docs/ only with UPDATE_SCREENSHOTS=1.
 */

test.skip(!process.env.E2E_SYNC_EMULATOR, 'needs the emulators: npm run test:e2e:sync');
test.use({ storageState: signedIn, viewport: { width: 412, height: 915 } });

const SHOTS = 'docs/ux/screenshots/ui-v2/sync';
const on = (page: Page) => (id: string) => page.getByTestId(id).filter({ visible: true });
const shot = (page: Page, name: string) => evidence(page, `${SHOTS}/${name}.png`, { fullPage: true });

test('the points wizard waits for the first pull, then says sync is not available and lets the person go on', async ({ page, context }) => {
  test.setTimeout(120_000);
  const id = on(page);
  await page.goto('/');
  await expect(id('v2-home')).toBeVisible();
  await id('open-menu').click();
  await id('nav-farm').click();
  await id('hub-people').click();
  await id('add-person').click();
  await id('person-name').fill('แดง');
  await id('role-tapper').click();
  await id('person-save').click();
  await expect(id('people-list')).toContainText('แดง');
  await id('v2-back').click();
  await id('hub-farms').click();
  await id('add-farm').click();
  await id('property-name').fill('สวนจันทเขลม');
  await id('property-crop-rubber').click();
  await id('property-save').click();
  await expect(id('farms-list')).toContainText('สวนจันทเขลม');

  await id('open-wizard').click();
  await id('points-wizard').locator('[data-testid^="wizard-farm-"]').first().click();
  await id('points-wizard').locator('[data-testid^="wizard-tapper-"]').first().click();
  await id('wizard-next').click();
  await id('points-wizard').locator('[data-testid^="wizard-name-"]').first().fill('จุด 1');

  // Online, still trying: waits, and create is not yet offered.
  await expect(id('wizard-wait-pull')).toBeVisible();
  await expect(id('screen-header').getByTestId('wizard-create')).toBeDisabled();
  await shot(page, 'wizard-waiting');

  // The grace period ends without a first pull: says so, and create works.
  await expect(id('wizard-no-sync')).toBeVisible({ timeout: 40_000 });
  await expect(id('wizard-wait-pull')).toHaveCount(0);
  await expect(id('screen-header').getByTestId('wizard-create')).toBeEnabled();
  await shot(page, 'wizard-cannot-sync');

  // Offline has its own words.
  await context.setOffline(true);
  await expect(id('wizard-no-sync')).toContainText('ไม่มีอินเทอร์เน็ต');
  await shot(page, 'wizard-offline');

  await id('wizard-create').click();
  await expect(id('farms-list')).toContainText('1 จุดชั่ง');
});
