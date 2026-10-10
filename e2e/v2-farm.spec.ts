import { expect, test, type Page } from '@playwright/test';

import { evidence } from './fixtures';

/**
 * D-83: one working sandbox app on v2, in the real web build. `/` shows the
 * splash and hands over to the v2 home; from the ☰ menu, ข้อมูลฟาร์ม and
 * every settings screen work offline (farm mockup v1.1.0 sections 1–6) and
 * what was saved is still there after a reload, read back from the local
 * event log. Screenshots at 412×915 are evidence for the owner, beside the
 * mockup frames (written to docs/ only with UPDATE_SCREENSHOTS=1).
 */

const SHOTS = 'docs/ux/screenshots/ui-v2/farm';

// Portrait-first; the landscape projects run every spec, so skip by project.
test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'farm settings are portrait-first'));
test.use({ viewport: { width: 412, height: 915 } });

/** The visible one: screens under the top of the stack stay in the DOM. */
const on = (page: Page) => (id: string) => page.getByTestId(id).filter({ visible: true });
const shot = (page: Page, name: string) => evidence(page, `${SHOTS}/${name}.png`, { fullPage: true });

async function addPerson(page: Page, name: string, roles: string[], snap?: string) {
  const id = on(page);
  await id('add-person').click();
  await id('person-name').fill(name);
  for (const r of roles) await id(`role-${r}`).click();
  if (snap) await shot(page, snap);
  await id('person-save').click();
  await expect(id('people-list')).toContainText(name);
}

test('/ → splash → home → farm settings: add and edit everything offline, still there after a reload', async ({ page, context }) => {
  const id = on(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await expect(page.getByTestId('splash')).toBeVisible();
  await expect(page.getByTestId('splash')).toContainText('FarmMate');
  await shot(page, '00-splash');
  await expect(page).toHaveURL(/\/v2\/?$/);
  await expect(id('v2-home')).toBeVisible();
  await expect(id('sync-pill')).toBeVisible();
  await shot(page, '01-home');

  await context.setOffline(true);
  await id('open-menu').click();
  await id('nav-farm').click();
  await expect(id('farm-hub')).toBeVisible();

  // ── คน ────────────────────────────────────────────────────────────────
  await id('hub-people').click();
  await expect(id('people')).toBeVisible();
  await addPerson(page, 'แดง', ['tapper'], '04-person-form');
  await addPerson(page, 'นัด', ['tapper']);
  await addPerson(page, 'อาจารย์สมหวัง', ['manager', 'payer']);
  await addPerson(page, 'คุณพนม ครองแก้ว', ['tenant']);
  await shot(page, '03-people');
  // Edit: rename keeps the same person.
  await id('people-list').getByText('คุณพนม ครองแก้ว').click();
  await id('person-edit').click();
  await id('person-name').fill('คุณพนม ครองแก้ว (ผู้เช่า)');
  await id('person-save').click();
  await expect(id('person-detail')).toContainText('คุณพนม ครองแก้ว (ผู้เช่า)');
  await id('v2-back').click();
  await expect(id('people-list')).toContainText('คุณพนม ครองแก้ว (ผู้เช่า)');
  await id('v2-back').click();

  // ── คนรับซื้อยาง ────────────────────────────────────────────────────────
  await id('hub-buyers').click();
  await id('add-buyer').click();
  await id('buyer-name').fill('คนรับซื้อยาง ก');
  await shot(page, '07-buyer-form');
  await id('buyer-save').click();
  await id('add-buyer').click();
  await id('buyer-name').fill('คนรับซื้อยาง ข');
  await id('buyer-save').click();
  await id('buyers-list').getByText('คนรับซื้อยาง ข').click();
  await id('buyer-name').fill('คนรับซื้อยาง ข (ตลาดกลาง)');
  await id('buyer-save').click();
  await expect(id('buyers-list')).toContainText('คนรับซื้อยาง ข (ตลาดกลาง)');
  await shot(page, '06-buyers');
  await id('v2-back').click();

  // ── สวน ─────────────────────────────────────────────────────────────────
  await id('hub-farms').click();
  await id('add-farm').click();
  await id('property-name').fill('สวนจันทเขลม');
  await id('property-crop-rubber').click();
  // Typed key by key, as on a phone: the "ไม่ทราบ" beside each field goes on
  // the first key, and the input must keep its focus through that.
  await id('property-area').pressSequentially('125');
  await expect(id('property-area')).toHaveValue('125');
  await expect(id('property-area')).toBeFocused();
  await id('property-planted').pressSequentially('2554');
  await expect(id('property-planted')).toHaveValue('2554');
  await id('property-gps').pressSequentially('13.5, 100.2');
  await expect(id('property-gps')).toHaveValue('13.5, 100.2');
  await id('property-gps').fill('');
  await id('property-save').click();
  await id('add-farm').click();
  await id('property-name').fill('ทุเรียน ตะเคียนทอง');
  await id('property-crop-durian').click();
  await shot(page, '09-farm-form');
  await id('property-save').click();
  await expect(id('farms-list')).toContainText('125 ไร่');
  await expect(id('farms-list')).toContainText('ไม่ทราบ');

  // ── ตัวช่วยตั้งค่าจุดชั่ง: แดง 2 จุด, นัด 1 จุด ─────────────────────────────
  await id('open-wizard').click();
  await id('points-wizard').locator('[data-testid^="wizard-farm-"]').filter({ hasText: 'สวนจันทเขลม' }).click();
  await id('points-wizard').locator('[data-testid^="wizard-tapper-"]').filter({ hasText: 'แดง' }).click();
  await id('points-wizard').locator('[data-testid^="wizard-tapper-"]').filter({ hasText: 'นัด' }).click();
  await id('points-wizard').locator('[data-testid^="wizard-count-"][data-testid$="-more"]').first().click();
  await shot(page, '12-points-wizard');
  await id('wizard-next').click();
  const names = id('points-wizard').locator('[data-testid^="wizard-name-"]');
  await expect(names).toHaveCount(3);
  for (let i = 0; i < 3; i++) await names.nth(i).fill(`จุด ${i + 1}`);
  // Back to page 1 and forward again keeps every name typed.
  await id('wizard-prev').click();
  await id('wizard-next').click();
  await expect(names.nth(2)).toHaveValue('จุด 3');
  await shot(page, '13-points-wizard-names');
  await id('wizard-create').click();
  await expect(id('farms-list')).toContainText('3 จุดชั่ง');
  await shot(page, '08-farms');

  // ── สวน detail: new dated area, edit, add a point and assign it ──────────
  await id('farms-list').getByText('สวนจันทเขลม').click();
  await expect(id('property-detail')).toBeVisible();
  await id('change-area').click();
  await id('area-new').fill('130');
  await id('area-save').click();
  await expect(id('area-history')).toContainText('130 ไร่');
  await expect(id('area-history')).toContainText('125 ไร่');
  await shot(page, '10-farm');
  await id('add-point').click();
  await id('point-name').fill('จุด 1');
  await id('point-save').click();
  await expect(id('point-name-error')).toContainText('มีจุดชื่อ "จุด 1" ในสวนนี้แล้ว');
  await id('point-name').fill('จุด 4');
  await shot(page, '14-point-form');
  await id('point-save').click();
  await id('offer-now').click();
  await expect(page.getByTestId('plan-sheet')).toBeVisible();
  await page.getByTestId('plan-sheet').locator('[data-testid^="plan-tapper-"]').filter({ hasText: 'นัด' }).click();
  await shot(page, '16-point-plan');
  await page.getByTestId('plan-save').click();
  await expect(id('timeline')).toContainText('นัด');
  await expect(id('timeline')).toContainText('ตอนนี้');
  await shot(page, '15-point');
  // Rename the point.
  await id('point-rename').click();
  await id('point-name').fill('จุด 4 ริมคลอง');
  await id('point-save').click();
  await expect(page.getByTestId('screen-title').filter({ visible: true })).toHaveText('จุด 4 ริมคลอง');

  // ── จุดชั่งทั้งหมด, ส่วนแบ่ง, ตั้งค่าวันขาย, เครื่องนี้ (from the drawer) ──────
  await context.setOffline(false);
  await page.goto('/v2/points');
  await context.setOffline(true);
  await expect(id('points')).toContainText('จุด 4 ริมคลอง');
  await shot(page, '11-points');

  await context.setOffline(false);
  await page.goto('/v2/shares');
  await context.setOffline(true);
  await id('shares').getByText('แดง').click();
  await id('share-mode-custom').click();
  await id('share-pct').fill('55');
  await expect(id('share-owner')).toHaveText('→ เจ้าของสวน 45%');
  await shot(page, '18-share');
  await id('share-save').click();
  await expect(id('share-now')).toContainText('คนกรีดยาง 55%');
  await id('v2-back').click();
  await expect(id('shares')).toContainText('คนกรีดยาง 55%');
  await shot(page, '17-shares');

  await context.setOffline(false);
  await page.goto('/v2/sale-settings');
  await context.setOffline(true);
  await id('numbering-per-point').click();
  await id('zero-skip').click();
  await expect(id('numbering-per-point')).toHaveAttribute('aria-checked', 'true');
  await shot(page, '19-sale-settings');

  await context.setOffline(false);
  await page.goto('/v2/device');
  await expect(id('device')).toBeVisible();
  await shot(page, '20-device');

  await page.goto('/v2/farm');
  await expect(id('hub-people')).toContainText('4 คน');
  await expect(id('hub-buyers')).toContainText('2 ราย');
  await expect(id('hub-farms')).toContainText('2 สวน');
  await expect(id('hub-farms')).toContainText('4 จุดชั่ง');
  await expect(id('sync-pill')).toContainText('รอส่ง');
  await shot(page, '02-farm-hub');

  // ── Reload: everything comes back from the local log ────────────────────
  await page.reload();
  await context.setOffline(true);
  await expect(id('hub-people')).toContainText('4 คน');
  await id('hub-people').click();
  await expect(id('people-list')).toContainText('คุณพนม ครองแก้ว (ผู้เช่า)');
  await id('people-list').getByText('แดง').click();
  await expect(id('person-points')).toContainText('จุด 1');
  await expect(id('share-summary')).toContainText('คนกรีดยาง 55%');
  await shot(page, '05-person');
  await id('person-delete').click();
  await shot(page, '05b-person-delete');
  await page.getByTestId('delete-confirm-no').click();

  await context.setOffline(false);
  await page.goto('/v2/buyers');
  await expect(id('buyers-list')).toContainText('คนรับซื้อยาง ข (ตลาดกลาง)');
  await page.goto('/v2/farms');
  await expect(id('farms-list')).toContainText('130 ไร่');
  await page.goto('/v2/sale-settings');
  await expect(id('numbering-per-point')).toHaveAttribute('aria-checked', 'true');
  await expect(id('zero-skip')).toHaveAttribute('aria-checked', 'true');

  // Soft delete and restore a buyer, after the reload too.
  await page.goto('/v2/buyers');
  await id('buyers-list').getByText('คนรับซื้อยาง ก').click();
  await id('buyer-delete').click();
  await page.getByTestId('delete-confirm-yes').click();
  await expect(id('buyers-list')).not.toContainText('คนรับซื้อยาง ก');
  await page.reload();
  await id('show-deleted').click();
  await expect(id('deleted-list')).toContainText('คนรับซื้อยาง ก');
  await expect(id('deleted-list')).toContainText('ลบแล้ว');
  await id('deleted-list').locator('[data-testid^="restore-"]').click();
  await id('hide-deleted').click();
  await expect(id('buyers-list')).toContainText('คนรับซื้อยาง ก');

  expect(errors).toEqual([]);
});

test('a deep link opens its screen directly, with no splash or home first', async ({ page }) => {
  const seen: string[] = [];
  await page.goto('/v2/farm', { waitUntil: 'commit' });
  for (let i = 0; i < 15; i++) {
    seen.push(
      await page.evaluate(() =>
        document.querySelector('[data-testid="splash"]') ? 'splash' : document.querySelector('[data-testid="v2-home"]') ? 'home' : 'other',
      ),
    );
    await page.waitForTimeout(40);
  }
  await expect(page.getByTestId('farm-hub')).toBeVisible();
  expect(seen).not.toContain('splash');
  expect(seen).not.toContain('home');
});

test('an old v1 link lands on the v2 home, not an unmatched-route page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // The page itself comes back as a 404 locally; anything else logged is a fault (React #418 = hydration).
  page.on('console', (m) => m.type() === 'error' && !/status of 404/.test(m.text()) && errors.push(m.text()));

  // serve-dist answers an unknown path with the app's +not-found page, as a 404.
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/v2\/?$/);
  await expect(page.getByTestId('v2-home')).toBeVisible();

  // Firebase Hosting answers it with the same page, as a 200 (firebase.json `** → /+not-found.html`).
  await page.route('**/sale/abc/counter', (route) => route.fulfill({ path: 'dist/+not-found.html', contentType: 'text/html' }));
  await page.goto('/sale/abc/counter');
  await expect(page).toHaveURL(/\/v2\/?$/);
  await expect(page.getByTestId('v2-home')).toBeVisible();

  expect(errors).toEqual([]);
});
