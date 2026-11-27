import { expect, test, type Page } from './test';

import type { MasterPayload } from '../src/core/types';
import { FIXTURE_GROUP_ID, LogBuilder } from '../src/core/fixtures';
import type { FinanceEvent, FinancePayload } from '../src/core/finance/types';
import { evidence, seedEvents, seedMaster, splashEvidence, watchSplash } from './fixtures';
import { smallTargets, textFit } from './text-fit';

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
/** Keys on a field's app pad (E01-S20): `<testID>-pad-key-<k>`; no OS keyboard. */
async function keys(page: Page, field: string, text: string) {
  for (const k of text) await on(page)(`${field}-pad-key-${k}`).click();
}

async function addPerson(page: Page, name: string, roles: string[], snap?: string) {
  const id = on(page);
  await id('add-person').click();
  await id('person-name').fill(name);
  for (const r of roles) await id(`role-${r}`).click();
  if (snap) await shot(page, snap);
  // Owner 2026-11-07 (style I): Save is the full-width button pinned at the foot, not in the header.
  await expect(id('save-bar').getByTestId('person-save')).toBeVisible();
  await expect(id('screen-header').getByTestId('person-save')).toHaveCount(0);
  // pinned at the foot: its bottom sits near the viewport's, and stays there when the form scrolls
  const vh = page.viewportSize()!.height;
  const atFoot = async () => {
    const b = (await id('person-save').boundingBox())!;
    expect(b.y + b.height).toBeGreaterThan(vh - 40);
    expect(b.y + b.height).toBeLessThanOrEqual(vh + 1);
  };
  await atFoot();
  await page.mouse.wheel(0, 400);
  await atFoot();
  await id('person-save').click();
  await expect(id('people-list')).toContainText(name);
}

test('/ → splash → home → farm settings: add and edit everything offline, still there after a reload', async ({ page, context }) => {
  // One flow through five screens and a reload: 11 s alone, over the 30 s default when 8 workers share 4 cores.
  test.setTimeout(90_000);
  const id = on(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  const splash = await watchSplash(page);
  await page.goto('/');
  expect(await splash()).toContain('FarmMate');
  await splashEvidence(page, `${SHOTS}/00-splash.png`);
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
  await addPerson(page, 'อาจารย์สมหวัง', ['manager']);
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
  // Area and planted year on the app pad (E01-S20): the card shows "ไม่ทราบ" until set.
  await expect(id('property-area')).toContainText('ไม่ทราบ');
  await id('property-area').click();
  await keys(page, 'property-area', '125');
  await id('property-area-done').click();
  await expect(id('property-area')).toContainText('125');
  // Typed in ค.ศ. on a พ.ศ. device: the card shows it in พ.ศ. (NP-13).
  await id('property-planted').click();
  await keys(page, 'property-planted', '2011');
  await id('property-planted-pad-key-done').click();
  await expect(id('property-planted')).toContainText('2554');
  await expect(id('property-planted')).toContainText('พ.ศ.');
  // GPS stays a text field (wrapping, full width — Q6), typed key by key.
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

  // The helper stays on offer and can be used again on a farm that has points:
  // it lists them, refuses a name already taken, and adds the next one.
  await id('open-wizard').click();
  await id('points-wizard').locator('[data-testid^="wizard-farm-"]').filter({ hasText: 'สวนจันทเขลม' }).click();
  await expect(id('wizard-existing')).toContainText('จุด 1');
  await id('points-wizard').locator('[data-testid^="wizard-tapper-"]').filter({ hasText: 'แดง' }).click();
  await id('wizard-next').click();
  await id('points-wizard').locator('[data-testid^="wizard-name-"]').first().fill('จุด 1');
  await expect(id('save-bar').getByTestId('wizard-create')).toBeVisible();
  await id('wizard-create').click();
  await expect(id('wizard-duplicates')).toBeVisible();
  await id('points-wizard').locator('[data-testid^="wizard-name-"]').first().fill('จุด 5');
  await id('wizard-create').click();
  await expect(id('farms-list')).toContainText('4 จุดชั่ง');

  // ── สวน detail: new dated area, edit, add a point and assign it ──────────
  await id('farms-list').getByText('สวนจันทเขลม').click();
  await expect(id('property-detail')).toBeVisible();
  await id('change-area').click();
  // The decimal pad sits in the change-area sheet itself (NP-12).
  await keys(page, 'area-new', '130');
  await expect(id('area-new-display')).toHaveText('130');
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
  await id('share-pct').click();
  await keys(page, 'share-pct', '55');
  await id('share-pct-pad-key-done').click();
  await expect(id('share-pct')).toContainText('→ เจ้าของสวน 45%');
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
  await expect(id('hub-farms')).toContainText('5 จุดชั่ง');
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

/**
 * E01-S26 (choice tiles per screen) on the real build, offline: at 320 px with
 * text L nothing is cut, nothing sticks out and every target is ≥ 48 (PS26-12)
 * on the screens this story changed, in the states the owner reviewed on
 * 2026-11-23 (rvs26-06 role link, rvs26-07 ask tiles, the wizard tapper rows).
 * The prep time sheet and its wheel are checked in v2-prepare.spec.ts.
 *
 * SHOT_DIR=<folder> also saves 390×844 pictures for the side-by-side with the
 * mockup (evidence for the dashboard card; nothing is written to docs/).
 */

const onS26 = (page: Page) => (id: string) => page.getByTestId(id).filter({ visible: true });
const s26Shots = process.env.SHOT_DIR;

const S26_FARM: MasterPayload[] = [
  { t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] },
  { t: 'person_added', personId: 'nat', name: 'นัด', roles: ['tapper'], otherRoles: [] },
  { t: 'person_added', personId: 'long', name: 'สมหวังผู้ช่วยกรีดยางแปลงหลังบ้านริมคลองใหญ่', roles: ['tapper'], otherRoles: [] },
  { t: 'buyer_added', buyerId: 'buyer-a', name: 'คนรับซื้อยาง ก (ตัวอย่าง)' },
  { t: 'property_added', propertyId: 'fa', name: 'จันทเขลม', crop: 'rubber' },
  { t: 'area_recorded', propertyId: 'fa', entryId: 'ar1', centiRai: 12_500, effective: '2020-01-01' },
  { t: 'point_added', pointId: 'a4', propertyId: 'fa', name: 'จุด 4' },
  { t: 'tapper_assigned', assignmentId: 's4', pointId: 'a4', tapperId: 'nat' },
];

const s26Fin = (n: number, targetId: string, payload: FinancePayload): FinanceEvent => ({
  id: `e2e-fin-${n}`,
  groupId: FIXTURE_GROUP_ID,
  deviceSeq: n,
  ts: Date.now(),
  actor: { userId: 'pre-login', deviceId: 'dev-seed' },
  source: 'app',
  targetId,
  baseEventId: null,
  payload,
});
const s26Loan = (amountSatang: number, date: string): FinancePayload => ({
  t: 'debt_added',
  fields: { worker: { id: 'nat', name: 'นัด' }, kind: 'loan', amountSatang, date, note: '', lender: { id: 'farm', name: 'เงินสวน' }, fertilizer: null, carriedForward: false },
});

async function s26Fits(page: Page, what: string) {
  expect(await textFit(page), `${what}: nothing cut or sticking out`).toEqual([]);
  expect(await smallTargets(page), `${what}: targets ≥ 48`).toEqual([]);
}

async function s26Snap(page: Page, name: string) {
  if (!s26Shots) return;
  const size = page.viewportSize()!;
  if (size.width === 390) await page.screenshot({ path: `${s26Shots}/${name}.png` });
}

for (const [width, size] of [
  [320, 'l'],
  [390, 'm'],
] as const) {
  test.describe(`E01-S26 screens at ${width} px text ${size.toUpperCase()}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((s) => localStorage.setItem('mon-farm:text-size', s), size);
      await seedMaster(page, S26_FARM);
    });

    test('add person: role tiles, the centred "เพิ่มบทบาทอื่น" link, then the field with ยกเลิก (rvs26-06)', async ({ page, context }) => {
      const id = onS26(page);
      await page.goto('/v2/person/new');
      await context.setOffline(true);
      await expect(id('person-other-role-open')).toBeVisible();
      await expect(id('person-other-role')).toHaveCount(0);
      await s26Fits(page, 'person form');
      await s26Snap(page, 's26-person-link');
      await id('person-other-role-open').click();
      await expect(id('person-other-role')).toBeVisible();
      await s26Fits(page, 'person form, field open');
      await s26Snap(page, 's26-person-open');
      await id('person-other-role-cancel').click();
      await expect(id('person-other-role')).toHaveCount(0);
    });

    test('sale prep: the time sheet (08:00–13:00 + กำหนดเอง) and the wheel (prep-time-default)', async ({ page, context }) => {
      const id = onS26(page);
      await page.goto('/v2/prepare');
      await context.setOffline(true);
      await id('prep-date').click();
      await id('prep-date-picker-tomorrow').click();
      await id('prep-date-picker-done').click();
      await expect(id('prep-time')).toBeVisible();
      await expect(id('prep-time-none')).toHaveCount(0);
      await s26Fits(page, 'prep time sheet');
      await s26Snap(page, 's26-prep-time');
      await id('prep-time-custom').click();
      await expect(id('prep-time-wheel-done')).toContainText('10:00');
      await s26Fits(page, 'prep time wheel');
      await s26Snap(page, 's26-prep-wheel');
    });

    test('people list: the group box and its sheet', async ({ page }) => {
      const id = onS26(page);
      await page.goto('/v2/people');
      await expect(id('people-filter')).toBeVisible();
      await s26Fits(page, 'people list');
      await id('people-filter').click();
      await expect(id('people-filter-sheet')).toBeVisible();
      await s26Fits(page, 'people group sheet');
    });

    test('points wizard: tappers are rows with tick boxes, several at once (wizard-tapper-pick)', async ({ page }) => {
      const id = onS26(page);
      await page.goto('/v2/points-wizard');
      await id('wizard-farm-fa').click();
      await id('wizard-tapper-red').click();
      await id('wizard-tapper-nat').click();
      await expect(id('wizard-tapper-red')).toHaveAttribute('aria-checked', 'true');
      await expect(id('wizard-tapper-nat')).toHaveAttribute('aria-checked', 'true');
      await expect(id('wizard-tapper-red')).toHaveAttribute('role', 'checkbox');
      await s26Fits(page, 'points wizard');
      await id('wizard-tapper-long').scrollIntoViewIfNeeded();
      await s26Snap(page, 's26-wizard-tappers');
    });

    test('closeout summary: the two asks are style I tiles with no frame around them (rvs26-07)', async ({ page }) => {
      const id = onS26(page);
      const b = new LogBuilder('sale-s26');
      b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
      b.sys({ t: 'price_set', satangPerKg: 5250, indexRef: '' });
      b.sys({ t: 'pile_added', pileId: 'a4', zoneId: 'fa', name: 'a4', tareG: 2_000, stdNetG: 50_000 });
      b.acceptAt('a4', 1).acceptAt('a4', 2);
      await seedEvents(page, b.build().map((e) => ({ ...e, ts: Date.now() })));
      await page.goto('/v2/sale/sale-s26/settlement');
      await expect(id('co-summary')).toBeVisible();
      await expect(id('co-debt-ask')).toBeVisible();
      await expect(id('co-debt-none')).toHaveAttribute('role', 'radio');
      await id('co-debt-none').click();
      await expect(id('co-debt-none')).toHaveAttribute('aria-selected', 'true');
      // No box in a box: the ask block draws no frame.
      expect(await id('co-debt-ask').evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('0px');
      await s26Fits(page, 'closeout summary');
      await s26Snap(page, 's26-closeout-ask');
    });

    test('basket list: the "คนกรีด" and "เข่ง" labels share one top line, B+E and E+E (item 9, mockup p11)', async ({ page }) => {
      const id = onS26(page);
      const labelTops = () =>
        id('hist-filters').evaluate((row) => [...row.children].map((col) => col.firstElementChild!.getBoundingClientRect().top));
      const b = new LogBuilder('sale-s26-hist');
      b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
      b.sys({ t: 'pile_added', pileId: 'a4', zoneId: 'fa', name: 'a4', tareG: 2_000, stdNetG: 50_000 });
      b.acceptAt('a4', 1);
      await seedEvents(page, b.build().map((e) => ({ ...e, ts: Date.now() })));
      // ทุกคน + นัด: a B bar beside the เข่ง box at 390 M. At 320 L ทุกคน may wrap, which switches to E+E (#257).
      await page.goto('/v2/sale/sale-s26-hist/history');
      await expect(id('hist-kind')).toBeVisible();
      if (width === 390) await expect(id('hist-tapper-all')).toBeVisible();
      const [tapperB, kindB] = await labelTops();
      await s26Snap(page, 'labelfix-hist-b-e');
      expect(Math.abs(tapperB - kindB), `B+E label tops ${tapperB} / ${kindB}`).toBeLessThanOrEqual(1);
      // E+E: four segments (ทุกคน + three tappers), so both filters are E boxes.
      await seedMaster(page, [
        { t: 'point_added', pointId: 'a5', propertyId: 'fa', name: 'จุด 5' },
        { t: 'point_added', pointId: 'a6', propertyId: 'fa', name: 'จุด 6' },
        { t: 'tapper_assigned', assignmentId: 's5', pointId: 'a5', tapperId: 'red' },
        { t: 'tapper_assigned', assignmentId: 's6', pointId: 'a6', tapperId: 'long' },
      ]);
      const e = new LogBuilder('sale-s26-hist-e');
      e.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
      for (const p of ['a4', 'a5', 'a6']) e.sys({ t: 'pile_added', pileId: p, zoneId: 'fa', name: p, tareG: 2_000, stdNetG: 50_000 });
      e.acceptAt('a4', 1).acceptAt('a5', 1).acceptAt('a6', 1);
      await seedEvents(page, e.build().map((ev) => ({ ...ev, ts: Date.now() })));
      await page.goto('/v2/sale/sale-s26-hist-e/history');
      await expect(id('hist-kind')).toBeVisible();
      await expect(id('hist-tapper-all')).toHaveCount(0);
      const [tapperE, kindE] = await labelTops();
      await s26Snap(page, 'labelfix-hist-e-e');
      expect(Math.abs(tapperE - kindE), `E+E label tops ${tapperE} / ${kindE}`).toBeLessThanOrEqual(1);
    });

    test('expenses: the filter boxes; debt history: the kind tiles', async ({ page }) => {
      const id = onS26(page);
      await page.evaluate((ev) => localStorage.setItem('mon-farm:finance-events', JSON.stringify(ev)), [s26Fin(1, 'debt-nat', s26Loan(300_000, '2026-09-01'))]).catch(() => undefined);
      await page.goto('/v2/expenses');
      await expect(id('filter-stage')).toBeVisible();
      await s26Fits(page, 'expenses filters');
      await page.evaluate((ev) => localStorage.setItem('mon-farm:finance-events', JSON.stringify(ev)), [s26Fin(1, 'debt-nat', s26Loan(300_000, '2026-09-01'))]);
      await page.goto('/v2/debt/nat?name=นัด');
      await expect(id('debt-filter-all')).toBeVisible();
      await s26Fits(page, 'debt history');
    });
  });
}
