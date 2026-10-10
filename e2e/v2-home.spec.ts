import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { LogBuilder, readyPile, setUpSale } from '../src/core/fixtures';
import type { FinanceEvent } from '../src/core/finance/types';
import type { BuiltinRole, MasterPayload } from '../src/core/types';
import { evidence, seedEvents, seedMaster } from './fixtures';

/**
 * The splash and the v2 home as drawn (e03-v2-splash-home): flow-v1 screens
 * 1 and 3, farm v1.1.0 screens 1 and 25. The home reads sales, farm data
 * and money from the local log, and shows them with the network gone.
 * Screenshots and mockup-vs-build pairs at 412×915 go to docs/ only with
 * UPDATE_SCREENSHOTS=1.
 */

const SHOTS = 'docs/ux/screenshots/ui-v2/home';
const MOCKUPS = resolve(__dirname, '../docs/ux/mockups');

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'the home is portrait-first'));
test.use({ viewport: { width: 412, height: 915 } });

const shot = (page: Page, name: string, fullPage = false) => evidence(page, `${SHOTS}/${name}.png`, { fullPage });

/** A sale on `day` (Bangkok morning) with `n` baskets of 50 kg; `closed` finishes it. */
function sale(id: string, day: string, n: number, closed: boolean) {
  const b = setUpSale(new LogBuilder(id));
  readyPile(b, 'p1');
  for (let i = 0; i < n; i++) b.accept('p1');
  if (closed) b.sys({ t: 'sale_closed' });
  const events = b.build();
  // The builder's clock starts at a fixed instant; move the sale to its day.
  const shift = Date.parse(`${day}T07:00:00+07:00`) - events[0].ts;
  return events.map((e) => ({ ...e, ts: e.ts + shift }));
}

const person = (personId: string, name: string, roles: BuiltinRole[]): MasterPayload => ({ t: 'person_added', personId, name, roles, otherRoles: [] });

/** One expense paid by a person, so the farm owes it back (E11-S02). */
async function seedOwed(page: Page, name: string, satang: number) {
  const e: FinanceEvent = {
    id: `e2e-owed-${satang}`,
    deviceSeq: 1,
    ts: Date.now(),
    actor: { userId: 'pre-login', deviceId: 'dev-seed' },
    source: 'app',
    targetId: `e2e-expense-${satang}`,
    baseEventId: null,
    payload: {
      t: 'expense_created',
      fields: { amountSatang: satang, date: '2026-09-01', stage: 'actual', categoryId: null, propertyId: null, item: '', note: '', payer: { id: 'p-somwang', name } },
    },
  };
  await page.evaluate((ev) => localStorage.setItem('mon-farm:finance-events', JSON.stringify([ev])), e);
}

test('/ → splash → home: as drawn, empty, then live rows from the local log, offline', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await expect(page.getByTestId('splash')).toBeVisible();
  await shot(page, '00-splash');
  await expect(page).toHaveURL(/\/v2\/?$/);
  const home = page.getByTestId('v2-home');
  await expect(home).toBeVisible();
  await expect(page.getByTestId('home-to-know')).toContainText('ยังไม่มีเรื่องที่ต้องรู้หรือจัดการ');
  await shot(page, '01-home-empty');

  await page.getByTestId('open-menu').click();
  await expect(page.getByTestId('nav-farm')).toContainText('สวนและจุดชั่ง');
  await shot(page, '02-menu');
  await page.keyboard.press('Escape');

  // The local log is what the home reads: seed it, reload (the static host
  // needs the network for that), then use the home with the network gone.
  await seedEvents(page, [...sale('e2e-old', '2026-09-18', 42, true), ...sale('e2e-now', '2026-10-09', 3, false)]);
  await seedMaster(page, [person('p-daeng', 'แดง', ['tapper']), person('p-nat', 'นัด', ['tapper']), person('p-somwang', 'อาจารย์สมหวัง', ['manager'])]);
  await seedOwed(page, 'อาจารย์สมหวัง', 120_000);
  await page.reload();
  await context.setOffline(true);
  await page.getByTestId('open-menu').click();
  await page.getByTestId('nav-sales').click();
  await page.goBack();

  await expect(page.getByTestId('home-open-sale')).toContainText('9 ต.ค. 2569 · 150 กก.');
  await expect(page.getByTestId('home-open-sale')).toContainText('กำลังชั่ง');
  await expect(page.getByTestId('home-latest-sale')).toContainText('18 ก.ย. 2569 · 2,100 กก.');
  await expect(page.getByTestId('home-latest-sale')).toContainText('ปิดแล้ว');
  await expect(page.getByTestId('home-owed')).toContainText('1,200.00');
  await expect(page.getByTestId('home-owed')).toContainText('อาจารย์สมหวัง');
  await expect(page.getByTestId('mod-payables')).toContainText('1,200.00');
  await expect(page.getByTestId('mod-workers')).toContainText('2');
  await shot(page, '03-home-live', true);

  // Selling is one tap away; the sale list hangs off the home too.
  await page.getByTestId('home-sale-start').click();
  await expect(page).toHaveURL(/\/v2\/sale\/start\/?$/);
  await page.goBack();
  await page.getByTestId('home-sales').click();
  await expect(page).toHaveURL(/\/v2\/sales\/?$/);
  await page.goBack();
  // ข้อมูลคนงาน opens คน on its tappers only (v1.1.0 screen 26) ...
  await page.getByTestId('mod-workers').click();
  const list = page.getByTestId('people-list').filter({ visible: true });
  await expect(list).toContainText('แดง');
  await expect(list).not.toContainText('อาจารย์สมหวัง');
  // ... and still does when that address is loaded directly.
  await context.setOffline(false);
  await page.reload();
  await expect(page).toHaveURL(/\/v2\/people\/?\?filter=tapper$/);
  await expect(list).toContainText('แดง');
  await expect(list).not.toContainText('อาจารย์สมหวัง');

  expect(errors).toEqual([]);
});

/**
 * Mockup beside build, same width: the mockup screen (status bar hidden)
 * on the left, the web build on the right.
 */
test('mockup vs build, side by side', async ({ page, browser }) => {
  // Evidence only: it reads the mockup files, so it must not gate CI on them.
  test.skip(process.env.UPDATE_SCREENSHOTS !== '1', 'writes comparison images on request only');
  const mock = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await mock.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  async function mockShot(file: string, selector: string, height: number | null) {
    await mock.goto('file://' + resolve(MOCKUPS, file));
    const scr = mock.locator(selector).first();
    await scr.evaluate((el, h) => {
      const ph = el.closest('.phone') as HTMLElement;
      const fig = el.closest('figure') as HTMLElement;
      Object.assign(fig.style, { width: '432px', minWidth: '432px', maxWidth: 'none', flex: 'none' });
      Object.assign(ph.style, { width: '432px', padding: '10px', height: h ? `${h + 20}px` : 'auto' });
      Object.assign((el as HTMLElement).style, { width: '412px', borderRadius: '0' });
      const sb = el.querySelector('.sbar') as HTMLElement | null;
      if (sb) sb.style.display = 'none';
    }, height);
    return (await scr.screenshot()).toString('base64');
  }
  async function pair(name: string, left: string, right: string) {
    const cmp = await browser.newPage({ viewport: { width: 860, height: 915 } });
    await cmp.setContent(
      `<body style="margin:0;display:flex;gap:16px;padding:8px;background:#888;align-items:flex-start;font:13px sans-serif">` +
        `<figure style="margin:0"><figcaption>mockup</figcaption><img src="data:image/png;base64,${left}" width="412"></figure>` +
        `<figure style="margin:0"><figcaption>build</figcaption><img src="data:image/png;base64,${right}" width="412"></figure></body>`,
    );
    await evidence(cmp, `${SHOTS}/${name}.png`, { fullPage: true });
    await cmp.close();
  }
  const app = async (fullPage = false) => (await page.screenshot({ fullPage })).toString('base64');

  await page.goto('/');
  await expect(page.getByTestId('splash')).toBeVisible();
  const splash = await app();
  await pair('cmp-splash', await mockShot('flow-v1.html', '.screen[aria-label="หน้าเข้าสู่ระบบ"]', 915), splash);

  await expect(page.getByTestId('v2-home')).toBeVisible();
  await expect(page.getByTestId('home-to-know')).toBeVisible();
  await pair('cmp-home-v1', await mockShot('flow-v1.html', '.screen[aria-label^="หน้าแรก วันนี้"]', null), await app(true));
  await pair('cmp-home-v110', await mockShot('flow-farm-v1.1.0.html', '#s25 .screen', 915), await app());
  await page.getByTestId('open-menu').click();
  await expect(page.getByTestId('drawer')).toBeVisible();
  await pair('cmp-menu-v110', await mockShot('flow-farm-v1.1.0.html', '#s1 .screen', 915), await app());
  await mock.close();
});
