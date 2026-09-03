import { expect, test, type Page } from '@playwright/test';

/**
 * The farm profile (S27), end to end and entirely through the UI: the profile
 * is built on its own settings screen, offered on a new sale's setup screen,
 * and — the guarantee the whole story rests on — never written back to by a
 * sale that edits or rejects what it was offered.
 *
 * Every test here builds its own profile through the screen rather than
 * injecting one into localStorage, because "what the settings screen shows"
 * is precisely the assertion the no-mutation cases need to make.
 *
 * Isolation: Playwright gives each test its own browser context, so
 * `localStorage` — and with it both the sale index and `mon-farm:farm-profile`
 * — starts empty. Nothing here leaks into `setup.spec.ts` or
 * `sale-list.spec.ts`, and the profile is only ever seeded from a past sale by
 * opening THIS screen, which those suites never do.
 */

async function openProfileScreen(page: Page) {
  await page.goto('/');
  await page.getByTestId('open-settings').click();
  await page.getByTestId('open-farm-profile').click();
  await expect(page.getByTestId('farm-profile')).toBeVisible();
}

/** Builds the profile by hand, through the screen: one zone, one pile. */
async function buildProfile(page: Page, zoneName = 'โซนโปรไฟล์', tareKg = '2') {
  await openProfileScreen(page);
  await expect(page.getByTestId('profile-empty')).toBeVisible();

  await page.getByTestId('profile-new-zone-name').fill(zoneName);
  await page.getByTestId('profile-add-zone').click();

  await page.locator('[data-testid^="profile-pile-name-"]').fill('กองโปรไฟล์');
  await page.locator('[data-testid^="profile-pile-tare-"]').fill(tareKg);
  await page.locator('[data-testid^="profile-pile-std-"]').fill('50');
  await page.locator('[data-testid^="profile-add-pile-"]').click();
  await expect(page.locator('[data-testid^="profile-pile-p"]')).toContainText('กองโปรไฟล์');
}

async function startNewSale(page: Page) {
  await page.goto('/');
  await page.getByTestId('new-sale').click();
  await expect(page.getByTestId('start-counting')).toBeVisible();
}

test('a saved profile is offered as the starting point of a new sale', async ({ page }) => {
  await buildProfile(page);
  await startNewSale(page);

  await expect(page.getByTestId('profile-offer')).toBeVisible();
  await expect(page.locator('[data-testid^="offer-zone-name-"]')).toHaveValue('โซนโปรไฟล์');
  await expect(page.locator('[data-testid^="offer-pile-"]')).toContainText('กองโปรไฟล์');
  // An offer, not sale state: nothing has been written yet, so the sale has
  // no zone editor of its own and "start counting" is still blocked.
  await expect(page.locator('[data-testid^="zone-editor-"]')).toHaveCount(0);
  await expect(page.getByTestId('start-counting')).toBeDisabled();
});

test('accepting the offer writes real zone and pile events that survive a reload', async ({ page }) => {
  await buildProfile(page);
  await startNewSale(page);

  await page.getByTestId('offer-accept').click();
  await expect(page.getByTestId('profile-offer')).toHaveCount(0);
  await expect(page.locator('[data-testid^="zone-editor-"]')).toContainText('โซนโปรไฟล์');

  await page.reload();
  await expect(page.locator('[data-testid^="zone-editor-"]')).toContainText('โซนโปรไฟล์');
  await expect(page.locator('[data-testid^="pile-pile-"]')).toContainText('ตะกร้า 2 + มาตรฐาน 50');
});

test('an offered tare edited for one sale does not change the saved profile', async ({ page }) => {
  await buildProfile(page, 'โซนโปรไฟล์', '2');
  await startNewSale(page);

  await page.locator('[data-testid^="offer-edit-pile-"]').click();
  await page.locator('[data-testid^="pile-edit-tare-"]').fill('2.6');
  await page.locator('[data-testid^="pile-edit-save-"]').click();
  await page.getByTestId('offer-accept').click();

  // This sale counts against the corrected tare…
  await expect(page.locator('[data-testid^="pile-pile-"]')).toContainText('ตะกร้า 2.6 + มาตรฐาน 50');

  // …and the profile still holds the original one.
  await openProfileScreen(page);
  await expect(page.locator('[data-testid^="profile-pile-p"]')).toContainText('ตะกร้า 2 + มาตรฐาน 50');
});

test('rejecting the offer and typing a zone by hand leaves the profile untouched', async ({ page }) => {
  await buildProfile(page);
  await startNewSale(page);

  await page.locator('[data-testid^="offer-reject-"]').click();
  await expect(page.getByTestId('profile-offer')).toHaveCount(0);

  await page.getByTestId('new-zone-name').fill('โซนพิมพ์เอง');
  await page.getByTestId('add-zone').click();
  await expect(page.locator('[data-testid^="zone-editor-"]')).toContainText('โซนพิมพ์เอง');

  await openProfileScreen(page);
  await expect(page.getByTestId('farm-profile')).toContainText('โซนโปรไฟล์');
  await expect(page.getByTestId('farm-profile')).not.toContainText('โซนพิมพ์เอง');
});

test('the next sale is offered the profile, not the previous sale’s edited version', async ({ page }) => {
  await buildProfile(page, 'โซนโปรไฟล์', '2');

  // Sale one: accept the offer with an edited tare.
  await startNewSale(page);
  await page.locator('[data-testid^="offer-edit-pile-"]').click();
  await page.locator('[data-testid^="pile-edit-tare-"]').fill('2.6');
  await page.locator('[data-testid^="pile-edit-save-"]').click();
  await page.getByTestId('offer-accept').click();
  await expect(page.locator('[data-testid^="pile-pile-"]')).toContainText('ตะกร้า 2.6');

  // Sale two: offered the saved profile, unchanged by anything sale one did.
  await startNewSale(page);
  await expect(page.getByTestId('profile-offer')).toBeVisible();
  await expect(page.locator('[data-testid^="offer-pile-"]')).toContainText('ตะกร้า 2 + มาตรฐาน 50');
});

test('a profile the owner has emptied stays empty, and setup falls back to the blank form', async ({ page }) => {
  await buildProfile(page);

  await page.locator('[data-testid^="profile-remove-zone-"]').first().click();
  await page.locator('[data-testid^="profile-remove-zone-"][data-testid$="-confirm"]').click();
  await expect(page.getByTestId('profile-empty')).toBeVisible();

  // A sale exists to seed from by now only if one was started; either way,
  // re-opening the screen must not un-empty a profile emptied on purpose.
  await startNewSale(page);
  await expect(page.getByTestId('profile-offer')).toHaveCount(0);
  await expect(page.getByTestId('new-zone-name')).toBeVisible();

  await openProfileScreen(page);
  await expect(page.getByTestId('profile-empty')).toBeVisible();
});

test('a hand-built profile emptied on purpose is not re-seeded from the last sale', async ({ page }) => {
  // The case above empties a profile while the only sale in existence has no
  // zones, so nothing could have been seeded either way. This is the one that
  // actually bites: a profile typed by hand (never seeded, so `establishedTs`
  // has to be set by the hand-build), a real sale with real zones to seed
  // from, and the owner clearing the profile out on purpose. Regression for
  // the QA finding of 2026-09-03.
  await buildProfile(page, 'โซนมือ', '2');

  await startNewSale(page);
  await page.locator('[data-testid^="offer-reject-"]').click();
  await page.getByTestId('new-zone-name').fill('โซนจากการขาย');
  await page.getByTestId('add-zone').click();
  await page.locator('[data-testid^="pile-name-"]').fill('กองจากการขาย');
  await page.locator('[data-testid^="pile-tare-"]').fill('9.9');
  await page.locator('[data-testid^="add-pile-"]').click();
  await expect(page.locator('[data-testid^="pile-pile-"]')).toContainText('กองจากการขาย');

  await openProfileScreen(page);
  await page.locator('[data-testid^="profile-remove-zone-"]').first().click();
  await page.locator('[data-testid^="profile-remove-zone-"][data-testid$="-confirm"]').click();
  await expect(page.getByTestId('profile-empty')).toBeVisible();

  await openProfileScreen(page);
  await expect(page.getByTestId('profile-empty')).toBeVisible();
  await expect(page.getByTestId('farm-profile')).not.toContainText('โซนจากการขาย');
});

test('the profile seeds itself once from the last sale, then stops', async ({ page }) => {
  // No profile yet: the first sale is typed by hand, exactly as before S27.
  await startNewSale(page);
  await page.getByTestId('new-zone-name').fill('โซนแรก');
  await page.getByTestId('add-zone').click();
  await page.locator('[data-testid^="pile-name-"]').fill('กองแรก');
  await page.locator('[data-testid^="pile-tare-"]').fill('2.2');
  await page.locator('[data-testid^="add-pile-"]').click();
  await expect(page.locator('[data-testid^="pile-pile-"]')).toContainText('กองแรก');

  // Opening the profile screen for the first time fills it in from that sale.
  await openProfileScreen(page);
  await expect(page.getByTestId('farm-profile')).toContainText('โซนแรก');
  await expect(page.locator('[data-testid^="profile-pile-p"]')).toContainText('ตะกร้า 2.2 + มาตรฐาน 50');

  // A second sale, changed by hand, does not re-seed anything: the profile
  // still shows what it was seeded with.
  await startNewSale(page);
  await page.getByTestId('offer-accept').click();
  await page.locator('[data-testid^="edit-pile-"]').click();
  await page.locator('[data-testid^="pile-edit-name-"]').fill('กองที่สอง');
  await page.locator('[data-testid^="pile-edit-save-"]').click();
  await expect(page.locator('[data-testid^="pile-pile-"]')).toContainText('กองที่สอง');

  await openProfileScreen(page);
  await expect(page.getByTestId('farm-profile')).toContainText('กองแรก');
  await expect(page.getByTestId('farm-profile')).not.toContainText('กองที่สอง');
});
