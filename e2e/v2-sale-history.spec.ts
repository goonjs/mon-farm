import { expect, test, type Page } from '@playwright/test';

import type { MasterPayload } from '../src/core/types';
import { LogBuilder } from '../src/core/fixtures';
import { evidence, seedEvents, seedMaster } from './fixtures';

/**
 * The basket history and the hold-to-undo button, edge cases (E04-S15) in the
 * real web build, offline, from the local event log: an empty sale, a filter
 * that finds nothing, numbers that repeat or skip, the undo question for a
 * keyboard, the undo button mid-hold, and the largest text size. Screenshots
 * at 412×915 are evidence for the owner (written to docs/ only with
 * UPDATE_SCREENSHOTS=1); the golden path is in v2-sale.spec.ts.
 */

const SHOTS = 'docs/ux/screenshots/ui-v2/sale';

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'the sale flow is portrait-first'));
test.use({ viewport: { width: 412, height: 915 } });

const FARM: MasterPayload[] = [
  { t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] },
  { t: 'person_added', personId: 'nat', name: 'นัด', roles: ['tapper'], otherRoles: [] },
  { t: 'buyer_added', buyerId: 'buyer-a', name: 'คนรับซื้อยาง ก (ตัวอย่าง)' },
  { t: 'property_added', propertyId: 'fa', name: 'จันทเขลม', crop: 'rubber' },
  { t: 'point_added', pointId: 'a1', propertyId: 'fa', name: 'จุด 1' },
  { t: 'point_added', pointId: 'a4', propertyId: 'fa', name: 'จุด 4' },
  { t: 'tapper_assigned', assignmentId: 's1', pointId: 'a1', tapperId: 'red' },
  { t: 'tapper_assigned', assignmentId: 's4', pointId: 'a4', tapperId: 'nat' },
];

const on = (page: Page) => (id: string) => page.getByTestId(id).filter({ visible: true });
const shot = (page: Page, name: string, fullPage = false) => evidence(page, `${SHOTS}/${name}.png`, { fullPage });

/** A sale with `a1` ready to count (its empty-scale check passed) and whatever baskets `build` adds. */
async function sale(page: Page, id: string, build: (b: LogBuilder) => void = () => undefined) {
  await seedMaster(page, FARM);
  const b = new LogBuilder(id);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'zone_added', zoneId: 'fa', name: 'จันทเขลม' });
  for (const p of ['a1', 'a4']) {
    b.sys({ t: 'pile_added', pileId: p, zoneId: 'fa', name: p, tareG: 2_000, stdNetG: 50_000 });
    b.sys({ t: 'zero_check', pileId: p, ok: true, readingG: 0 });
    b.sys({ t: 'tare_confirmed', pileId: p, tareG: 2_000 });
    b.sys({ t: 'ready', pileId: p });
  }
  build(b);
  const now = Date.now();
  await seedEvents(page, b.build().map((e, i) => ({ ...e, ts: now - (b.build().length - i) * 1_000 })));
}

test('empty sale, a filter that finds nothing, and numbers that repeat or skip', async ({ page }) => {
  const id = on(page);
  await sale(page, 'h-empty');
  await page.goto('/v2/sale/h-empty/history?point=a1');
  await expect(id('hist-empty')).toContainText('ยังไม่มีเข่ง');
  await shot(page, '8f-history-empty');

  await sale(page, 'h-bad', (b) => b.acceptAt('a1', 1).acceptAt('a1', 1).acceptAt('a1', 3).shortAt('a4', 1, 22_000, 2_000));
  await page.goto('/v2/sale/h-bad/history?point=a1');
  await expect(id('hist-numbers-bad')).toContainText('แดง: ขาด 2 · ซ้ำ 1');
  await shot(page, '8g-history-bad-numbers');

  await id('hist-tapper-nat').click();
  await id('hist-kind-full').click();
  await expect(id('hist-filter-empty')).toBeVisible();
  await expect(id('hist-numbers-bad')).toBeVisible();
  await shot(page, '8h-history-no-match');
});

test('a keyboard undo asks first; the undo button shows the hold in progress; the largest text still fits', async ({ page }) => {
  const id = on(page);
  await sale(page, 'h-undo', (b) => b.acceptAt('a1', 1).acceptAt('a1', 2));
  await page.goto('/v2/sale/h-undo/counter?point=a1');
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 3$/);
  await expect(id('tool-undo')).toContainText('กดค้าง · เข่ง 2');

  // Held part way: the line runs along the button, nothing is undone yet.
  const box = (await id('tool-undo').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(350);
  await shot(page, '8i-undo-holding');
  await page.mouse.up();
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 3$/);

  // Enter on the focused button has no hold behind it: it asks first.
  await id('tool-undo').focus();
  await page.keyboard.press('Enter');
  await expect(id('undo-confirm')).toContainText('ย้อนกลับเข่ง 2 ไหม');
  await shot(page, '8j-undo-confirm');
  await id('undo-confirm-yes').click();
  await expect(id('current-no')).toHaveText(/เข่งถัดไป 2$/);

  // The largest text size: the tool row and the history rows stay inside the screen.
  await page.evaluate(() => localStorage.setItem('mon-farm:text-size', 'l'));
  await page.reload();
  await expect(id('counter')).toBeVisible();
  const row = (await id('tool-undo').boundingBox())!;
  expect(row.x).toBeGreaterThanOrEqual(0);
  expect(row.x + row.width).toBeLessThanOrEqual(412);
  await shot(page, '8k-counter-large-text');
  await id('tool-history').click();
  await expect(id('history')).toBeVisible();
  await shot(page, '8l-history-large-text');
});
