import { expect, test, type Page } from '@playwright/test';

import { tokens } from '../design/tokens';
import { LogBuilder } from '../src/core/fixtures';
import { seedMaster, seedSale, testSaleId } from './fixtures';

/**
 * E04-S05: the recorder screen at weighing points. แดง taps three points on
 * two farms; weighing them in a mixed order keeps her numbers continuous,
 * switching point is two taps, and a reload brings the same six values back.
 */
test.use({ viewport: tokens.viewport.portrait, isMobile: true, hasTouch: true });

const SHOTS = 'docs/ux/screenshots/overnight/farm';

async function hold(page: Page) {
  const box = (await page.getByTestId('stage').last().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1_100);
  await page.mouse.up();
}

async function pick(page: Page, farm: string, point: string) {
  await page.locator('[data-testid^="pick-farm-"]', { hasText: farm }).last().click();
  await page.locator('[data-testid^="pick-point-"]', { hasText: point }).last().click();
}

test('3 points on 2 farms in a mixed order: numbers run on, values survive a reload', async ({ page, context }, info) => {
  const shot = async (name: string) => {
    if (info.project.name === 'phone-landscape') await page.screenshot({ path: `${SHOTS}/${name}.png` });
  };
  await seedMaster(page, [
    { t: 'settings_set', zeroCheck: 'skip' },
    { t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] },
    { t: 'property_added', propertyId: 'fA', name: 'จันทเขลม', crop: 'rubber' },
    { t: 'property_added', propertyId: 'fB', name: 'คลองพลู', crop: 'rubber' },
    { t: 'point_added', pointId: 'p1', propertyId: 'fA', name: 'จุด 1' },
    { t: 'point_added', pointId: 'p2', propertyId: 'fA', name: 'จุด 2' },
    { t: 'point_added', pointId: 'p3', propertyId: 'fB', name: 'จุด 3' },
    { t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red' },
    { t: 'tapper_assigned', assignmentId: 'a2', pointId: 'p2', tapperId: 'red' },
    { t: 'tapper_assigned', assignmentId: 'a3', pointId: 'p3', tapperId: 'red' },
  ]);
  await page.goto('/');
  await page.getByTestId('new-sale').click();
  await page.getByTestId('start-next').click();

  await pick(page, 'จันทเขลม', 'จุด 1');
  await expect(page.getByTestId('rec-current')).toHaveText('1');
  await expect(page.getByTestId('rec-tapper')).toHaveText('แดง');
  await hold(page);
  await expect(page.getByTestId('rec-current')).toHaveText('2');

  // Switch: เปลี่ยนจุด → the point, two taps when the farm is already picked.
  await page.getByTestId('rec-switch').click();
  await pick(page, 'คลองพลู', 'จุด 3');
  await expect(page.getByTestId('rec-point')).toContainText('คลองพลู · จุด 3');
  await expect(page.getByTestId('rec-current')).toHaveText('2');
  await hold(page);
  await page.getByTestId('rec-switch').click();
  await pick(page, 'จันทเขลม', 'จุด 2');
  await hold(page);
  await expect(page.getByTestId('rec-current')).toHaveText('4');
  await expect(page.getByTestId('rec-card-1')).toContainText('3');
  await expect(page.getByTestId('rec-card-kg')).toContainText('150');
  await expect(page.getByTestId('hold-label')).toHaveText('กดค้างเพื่อบันทึกเข่งเต็ม');
  await shot('e04-s05-recorder');

  await page.getByTestId('rec-menu').click();
  await page.getByTestId('rec-menu-list').click();
  await expect(page.getByTestId('rec-list')).toContainText('#3');
  await expect(page.getByTestId('rec-list')).toContainText('จุด 3');
  await shot('e04-s05-basket-list');
  await page.getByTestId('rec-list-close').click();

  await page.reload();
  await expect(page.getByTestId('rec-current')).toHaveText('4');
  await expect(page.getByTestId('rec-card-kg')).toContainText('150');
  await expect(page.getByTestId('rec-point')).toContainText('จันทเขลม · จุด 2');

  // E04-S09: undo offline, once confirmed; the number comes back; a reload agrees.
  await context.setOffline(true);
  await page.getByTestId('rec-undo').click();
  await expect(page.getByTestId('undo-confirm-detail')).toContainText('#3');
  await page.getByTestId('undo-confirm').click();
  await expect(page.getByTestId('rec-current')).toHaveText('3');
  await expect(page.getByTestId('rec-card-kg')).toContainText('100');
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByTestId('rec-current')).toHaveText('3');
  await expect(page.getByTestId('rec-card-kg')).toContainText('100');

  // Void basket 1 from the list: struck through, the gap stays.
  await page.getByTestId('rec-menu').click();
  await page.getByTestId('rec-menu-list').click();
  await page.getByTestId('rec-row-1').click();
  await shot('e04-s09-edit');
  await page.getByTestId('edit-void').click();
  await page.getByTestId('edit-void-confirm').click();
  await expect(page.getByTestId('rec-row-1')).toContainText('✗');
  await expect(page.getByTestId('rec-current')).toHaveText('3');
  await shot('e04-s09-voided');
});

test('completed sale: an edit that changes money asks why, and the flag is in the log (E04-S11)', async ({ page }, info) => {
  const shot = async (name: string) => {
    if (info.project.name === 'phone-landscape') await page.screenshot({ path: `${SHOTS}/${name}.png` });
  };
  await seedMaster(page, [
    { t: 'settings_set', zeroCheck: 'skip' },
    { t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] },
    { t: 'property_added', propertyId: 'fA', name: 'จันทเขลม', crop: 'rubber' },
    { t: 'point_added', pointId: 'p1', propertyId: 'fA', name: 'จุด 1' },
    { t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red' },
  ]);
  const saleId = testSaleId('s11');
  const b = new LogBuilder(saleId)
    .sys({ t: 'sale_started', farmName: '', buyer: 'ล้ง', manager: '', workerLead: '', where: 'farm' })
    .sys({ t: 'price_set', satangPerKg: 4_850, indexRef: '' })
    .sys({ t: 'zone_added', zoneId: 'fA', name: 'จันทเขลม' })
    .sys({ t: 'pile_added', pileId: 'p1', zoneId: 'fA', name: 'จุด 1', tareG: 2_000, stdNetG: 50_000 })
    .sys({ t: 'ready', pileId: 'p1' })
    .acceptAt('p1', 1)
    .acceptAt('p1', 2);
  await seedSale(page, saleId, b.build());
  await page.goto(`/sale/${saleId}/counter?pile=p1`);
  await expect(page.getByTestId('rec-status')).toHaveText('ร่าง');
  await page.getByTestId('rec-menu').click();
  await page.getByTestId('rec-menu-complete').click();
  await expect(page.getByTestId('rec-status')).toHaveText('เสร็จสิ้น');

  await page.getByTestId('rec-menu').click();
  await page.getByTestId('rec-menu-list').click();
  await page.getByTestId('rec-row-1').click();
  await page.getByTestId('edit-kg').fill('45');
  await page.getByTestId('edit-save').click();
  await expect(page.getByTestId('money-reason')).toBeVisible();
  await page.getByTestId('reason-0').click();
  await shot('e04-s11-money-reason');
  await page.getByTestId('reason-confirm').click();
  await expect(page.getByTestId('rec-card-kg')).toContainText('95');

  await page.reload();
  await expect(page.getByTestId('rec-status')).toHaveText('เสร็จสิ้น');
  const flags = await page.evaluate(
    (id) =>
      new Promise<{ reason: string }[]>((res) => {
        const o = indexedDB.open('mon-farm-v1', 1);
        o.onsuccess = () => {
          const r = o.result.transaction('events').objectStore('events').getAll();
          type Stored = { saleId: string; event: { kind: string; payload?: { t: string; reason: string } } };
          r.onsuccess = () =>
            res(
              (r.result as Stored[])
                .filter((x) => x.saleId === id && x.event.kind === 'sys' && x.event.payload?.t === 'money_edit')
                .map((x) => x.event.payload!),
            );
        };
      }),
    saleId,
  );
  expect(flags).toMatchObject([{ reason: 'ชั่งผิด' }]);

  // The sale list says it is completed.
  await page.goto('/');
  await expect(page.getByTestId(`sale-${saleId}`)).toContainText('เสร็จสิ้น');
  await expect(page.getByTestId(`sale-${saleId}`)).not.toContainText('เปิดอยู่');
});

test('bridge basket: แดง short 20 at จุด 1, topped up 30 at จุด 2 → (20 + 30) = 50; นัด\'s point asks nothing (E04-S06)', async ({ page }, info) => {
  const shot = async (name: string) => {
    if (info.project.name === 'phone-landscape') await page.screenshot({ path: `${SHOTS}/${name}.png` });
  };
  await seedMaster(page, [
    { t: 'settings_set', zeroCheck: 'skip' },
    { t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] },
    { t: 'person_added', personId: 'nat', name: 'นัด', roles: ['tapper'], otherRoles: [] },
    { t: 'property_added', propertyId: 'fA', name: 'จันทเขลม', crop: 'rubber' },
    { t: 'point_added', pointId: 'p1', propertyId: 'fA', name: 'จุด 1' },
    { t: 'point_added', pointId: 'p2', propertyId: 'fA', name: 'จุด 2' },
    { t: 'point_added', pointId: 'p3', propertyId: 'fA', name: 'จุด 3' },
    { t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red' },
    { t: 'tapper_assigned', assignmentId: 'a2', pointId: 'p2', tapperId: 'red' },
    { t: 'tapper_assigned', assignmentId: 'a3', pointId: 'p3', tapperId: 'nat' },
  ]);
  await page.goto('/');
  await page.getByTestId('new-sale').click();
  await page.getByTestId('start-next').click();
  await page.locator('[data-testid^="pick-tapper-"]', { hasText: 'แดง' }).last().click();
  await page.locator('[data-testid^="pick-point-"]', { hasText: 'จุด 1' }).last().click();

  // A short basket of 20 kg (scale 22, basket 2): it stays open, 30 still to fill.
  await page.getByTestId('rec-short').click();
  await page.getByTestId('short-reading-typed').fill('22');
  await page.getByTestId('short-confirm').click();
  await expect(page.getByTestId('rec-open')).toContainText('เข่ง 1 เปิดอยู่ · 20 กก.');
  await expect(page.getByTestId('rec-card-short')).toContainText('30');
  await shot('e04-s06-open');

  // แดง's next point: three ways; weigh the top-up on its own.
  await page.getByTestId('rec-switch').click();
  await page.locator('[data-testid^="pick-tapper-"]', { hasText: 'แดง' }).last().click();
  await page.locator('[data-testid^="pick-point-"]', { hasText: 'จุด 2' }).last().click();
  await expect(page.getByTestId('fill-sheet')).toContainText('เข่ง 1 ยังไม่เต็ม');
  await shot('e04-s06-fill-choice');
  await page.getByTestId('fill-part').click();
  await expect(page.getByTestId('caption')).toContainText('ตาชั่งควรอ่าน 32 กก.');
  await hold(page);
  await expect(page.getByTestId('rec-current')).toHaveText('2');
  await page.getByTestId('rec-menu').click();
  await page.getByTestId('rec-menu-list').click();
  await expect(page.getByTestId('rec-row-1')).toContainText('(20 + 30) = 50 กก.');
  await shot('e04-s06-bridged');
  await page.getByTestId('rec-list-close').click();

  // นัด's point: nothing to ask.
  await page.getByTestId('rec-switch').click();
  await page.locator('[data-testid^="pick-tapper-"]', { hasText: 'นัด' }).last().click();
  await page.locator('[data-testid^="pick-point-"]', { hasText: 'จุด 3' }).last().click();
  await expect(page.getByTestId('rec-point')).toContainText('จุด 3');
  await expect(page.getByTestId('fill-sheet')).toHaveCount(0);
  await expect(page.getByTestId('rec-current')).toHaveText('1');
});

test('backfill a point offline: 3 full + 20 kg numbered on, labelled, and kept over a reload (E04-S10)', async ({ page, context }, info) => {
  const shot = async (name: string) => {
    if (info.project.name === 'phone-landscape') await page.screenshot({ path: `${SHOTS}/${name}.png` });
  };
  await seedMaster(page, [
    { t: 'settings_set', zeroCheck: 'skip' },
    { t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] },
    { t: 'property_added', propertyId: 'fA', name: 'จันทเขลม', crop: 'rubber' },
    { t: 'point_added', pointId: 'p1', propertyId: 'fA', name: 'จุด 3' },
    { t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red' },
  ]);
  await page.goto('/');
  await page.getByTestId('new-sale').click();
  await page.getByTestId('start-next').click();
  await page.locator('[data-testid^="pick-point-"]', { hasText: 'จุด 3' }).last().click();
  await hold(page);
  await expect(page.getByTestId('rec-current')).toHaveText('2');

  await context.setOffline(true);
  await page.getByTestId('rec-menu').click();
  await page.getByTestId('rec-menu-backfill').click();
  await page.getByTestId('bf-full').fill('3');
  await page.getByTestId('bf-short').fill('20');
  await expect(page.getByTestId('bf-plan')).toContainText('เข่งที่ 2–4');
  await expect(page.getByTestId('bf-plan')).toContainText('เข่งที่ 5');
  await expect(page.getByTestId('bf-plan')).toContainText('170 กก.');
  await shot('e04-s10-backfill');
  await page.getByTestId('bf-save').click();
  await expect(page.getByTestId('rec-current')).toHaveText('6');
  await expect(page.getByTestId('rec-card-kg')).toContainText('220');

  await context.setOffline(false);
  await page.reload();
  await expect(page.getByTestId('rec-current')).toHaveText('6');
  await page.getByTestId('rec-menu').click();
  await page.getByTestId('rec-menu-list').click();
  await expect(page.getByTestId('rec-row-5')).toContainText('บันทึกย้อนหลัง');
  await expect(page.getByTestId('rec-row-1')).not.toContainText('บันทึกย้อนหลัง');
});
