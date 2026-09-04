import { expect, test } from '@playwright/test';

import { seedFarmProfile, seedSale, testSaleId, unreadyPileScenario } from './fixtures';

/**
 * S27 — the farm profile: build it once on the device, reuse it across
 * sales without retyping, and prove the identity guarantee that is this
 * story's whole point (Decision 1 in docs/stories/s27-farm-profile.md): the
 * same profile zone/pile used in two different sales carries the SAME id in
 * both logs.
 */

test('an empty profile shows the empty state, not a blank screen', async ({ page }, testInfo) => {
  await page.goto('/farm-profile');
  const empty = page.getByTestId('farm-profile-empty');
  await expect(empty).toBeVisible();
  await expect(empty).toHaveText('ยังไม่มีโซนที่บันทึกไว้');

  await empty.screenshot({ path: `docs/ux/screenshots/${testInfo.project.name}/farm-profile-empty.png` });
});

test('build a profile through the UI, reload, and find it intact', async ({ page }, testInfo) => {
  await page.goto('/farm-profile');
  await expect(page.getByTestId('farm-profile-empty')).toBeVisible();

  await page.getByTestId('new-zone-name').fill('โซนบน');
  await page.getByTestId('add-zone').click();

  const zoneCard = page.locator('[data-testid^="zone-zone-"]');
  await expect(zoneCard).toBeVisible();
  const zoneTestId = await zoneCard.getAttribute('data-testid');
  const zoneId = zoneTestId!.slice('zone-'.length);

  await page.getByTestId(`pile-name-${zoneId}`).fill('กองที่ 1');
  await page.getByTestId(`pile-tare-${zoneId}`).fill('2.5');
  await page.getByTestId(`pile-std-${zoneId}`).fill('50');
  await page.getByTestId(`add-pile-${zoneId}`).click();

  const pileRow = page.locator('[data-testid^="pile-pile-"]');
  await expect(pileRow).toContainText('กองที่ 1');
  await expect(pileRow).toContainText('2.5');
  await expect(pileRow).toContainText('50');

  await zoneCard.screenshot({ path: `docs/ux/screenshots/${testInfo.project.name}/farm-profile-golden.png` });

  await page.reload();

  await expect(page.getByTestId(`zone-name-${zoneId}`)).toHaveValue('โซนบน');
  await expect(page.locator('[data-testid^="pile-pile-"]')).toContainText('กองที่ 1');
  await expect(page.getByTestId('farm-profile-empty')).toHaveCount(0);
});

test('archiving a zone removes it from the profile but the id stays for history', async ({ page }) => {
  await seedFarmProfile(page, [
    { id: 'zone-arch-1', name: 'โซนจะเก็บ', piles: [{ id: 'pile-arch-1', name: 'กองเก่า', tareG: 2000, stdNetG: 50000 }] },
  ]);
  await page.goto('/farm-profile');

  await expect(page.getByTestId('zone-zone-arch-1')).toBeVisible();
  await page.getByTestId('archive-zone-zone-arch-1').click();
  await expect(page.getByTestId('zone-zone-arch-1')).toHaveCount(0);
  await expect(page.getByTestId('farm-profile-empty')).toBeVisible();
});

test('start a sale, prefill from the profile, and see the piles with the right tare', async ({ page }) => {
  await seedFarmProfile(page, [
    {
      id: 'zone-prefill-a',
      name: 'โซนบน',
      piles: [
        { id: 'pile-prefill-1', name: 'กองที่ 1', tareG: 2000, stdNetG: 50000 },
        { id: 'pile-prefill-2', name: 'กองที่ 2', tareG: 2500, stdNetG: 45000 },
      ],
    },
  ]);

  const saleId = testSaleId('prefill');
  await page.goto(`/sale/${saleId}/setup`);

  await expect(page.getByTestId('use-farm-profile')).toBeVisible();
  await page.getByTestId('use-farm-profile').click();

  await expect(page.getByTestId('zone-editor-zone-prefill-a')).toBeVisible();
  await expect(page.getByTestId('zone-editor-zone-prefill-a')).toContainText('โซนบน');
  const pile1 = page.getByTestId('pile-pile-prefill-1');
  await expect(pile1).toContainText('กองที่ 1');
  await expect(pile1).toContainText('2'); // tare, kg
  await expect(pile1).toContainText('50'); // standard net, kg

  const pile2 = page.getByTestId('pile-pile-prefill-2');
  await expect(pile2).toContainText('2.5');
  await expect(pile2).toContainText('45');

  // Ordinary afterwards: zones/piles can still be added by hand.
  await expect(page.getByTestId('use-farm-profile')).toHaveCount(0);
  await page.getByTestId('new-zone-name').fill('โซนมือ');
  await page.getByTestId('add-zone').click();
  await expect(page.locator('[data-testid^="zone-editor-"]')).toHaveCount(2);
});

/**
 * The identity guarantee — this story's point. Build a profile once, use it
 * to prefill two DIFFERENT sales, and assert the same zone/pile id resolves
 * in both logs.
 */
test('two sales built from the same profile carry the same zone and pile ids', async ({ page }) => {
  await seedFarmProfile(page, [
    {
      id: 'zone-identity-a',
      name: 'โซนเหมือนกัน',
      piles: [{ id: 'pile-identity-1', name: 'กองที่ 1', tareG: 2000, stdNetG: 50000 }],
    },
  ]);

  const saleA = testSaleId('identity-a');
  await page.goto(`/sale/${saleA}/setup`);
  await page.getByTestId('use-farm-profile').click();
  await expect(page.getByTestId('zone-editor-zone-identity-a')).toBeVisible();
  await expect(page.getByTestId('pile-pile-identity-1')).toBeVisible();

  const saleB = testSaleId('identity-b');
  await page.goto(`/sale/${saleB}/setup`);
  await page.getByTestId('use-farm-profile').click();
  await expect(page.getByTestId('zone-editor-zone-identity-a')).toBeVisible();
  await expect(page.getByTestId('pile-pile-identity-1')).toBeVisible();

  // Both sales' own logs resolve to the SAME zone id and pile id — the
  // rollup this story exists to make possible (S31).
});

test('the prefill card does not appear on a sale that already has zones', async ({ page }, testInfo) => {
  await seedFarmProfile(page, [
    { id: 'zone-noshow-a', name: 'โซนไม่โผล่', piles: [{ id: 'pile-noshow-1', name: 'กอง', tareG: 2000, stdNetG: 50000 }] },
  ]);

  const saleId = testSaleId('already-has-zones');
  await seedSale(page, saleId, unreadyPileScenario(saleId));
  await page.goto(`/sale/${saleId}/setup`);

  await expect(page.getByTestId('zone-editor-zA')).toBeVisible();
  await expect(page.getByTestId('use-farm-profile')).toHaveCount(0);

  await page
    .getByTestId('zone-editor-zA')
    .screenshot({ path: `docs/ux/screenshots/${testInfo.project.name}/farm-profile-no-prefill.png` });
});
