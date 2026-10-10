import { expect, test } from '@playwright/test';

import { tokens } from '../design/tokens';

/**
 * E03-S02: farms with dated area history, written with the network off.
 * Portrait, as the farm-data screens are (D-17); screenshots from the first
 * project only.
 */
test.use({ viewport: tokens.viewport.portrait, isMobile: true, hasTouch: true });

const SHOTS = 'docs/ux/screenshots/overnight/farm';

test('farms: create offline with optional fields blank, change area, survive a reload', async ({ page, context }, info) => {
  const shot = async (name: string) => {
    if (info.project.name === 'phone-landscape') await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  };

  await page.goto('/');
  await context.setOffline(true);
  // Lives in the ☰ menu since E01-S17.
  await page.getByTestId('open-menu').click();
  await page.getByTestId('open-farm-data').click();
  await page.getByTestId('farm-data-properties').click();

  // Durian farm with no area: shows ไม่ทราบ.
  await page.getByTestId('add-property').click();
  await page.getByTestId('property-name').fill('ทุเรียน ตะเคียนทอง');
  await page.getByTestId('crop-durian').click();
  await page.getByTestId('property-area').fill('0');
  await page.getByTestId('property-save').click();
  await expect(page.getByText('ใส่พื้นที่เป็นตัวเลขมากกว่า 0')).toBeVisible();
  await shot('e03-s02-property-form-error');
  await page.getByTestId('property-area').fill('');
  await page.getByTestId('property-save').click();

  // Rubber farm with area, planted year and GPS.
  await page.getByTestId('add-property').click();
  await page.getByTestId('property-name').fill('สวนจันทเขลม');
  await page.getByTestId('crop-rubber').click();
  await page.getByTestId('property-planted').fill('2554');
  await page.getByTestId('property-gps').fill('12.6113, 102.1035');
  await shot('e03-s02-property-form');
  await page.getByTestId('property-save').click();
  await expect(page.getByText('พื้นที่ ไม่ทราบ').first()).toBeVisible();

  // The detail (farm-14): each area change is a dated entry; the old one stays in history (MD-1).
  await page.getByText('สวนจันทเขลม').click();
  for (const [rai, from] of [['120', '1/1/2569'], ['125', '1/10/2569']]) {
    await page.getByTestId('change-area').click();
    await page.getByTestId('area-new').fill(rai);
    await page.getByTestId('area-new-date').fill(from);
    await page.getByTestId('area-save').click();
    await expect(page.getByTestId('property-area-now')).toContainText(`${rai} ไร่`);
  }
  await shot('e03-property-detail');

  // Data came from the local log; the app shell needs the network to reload (no service worker yet).
  await context.setOffline(false);
  await page.goto('/properties');
  await expect(page.getByText('125 ไร่')).toBeVisible();
  await shot('e03-s02-properties-list');

  await page.getByText('สวนจันทเขลม').click();
  await expect(page.getByTestId('area-history')).toContainText('120 ไร่');
  await expect(page.getByTestId('area-history')).toContainText('125 ไร่');
  await shot('e03-s02-property-history');

  await page.getByTestId('property-delete').click();
  await expect(page.getByTestId('delete-confirm')).toContainText('จุดชั่ง');
  await shot('e03-s02-property-delete-confirm');
});
