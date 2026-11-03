import { expect, test, type Page } from '@playwright/test';

import type { MasterPayload } from '../src/core/types';
import { FIXTURE_GROUP_ID, LogBuilder } from '../src/core/fixtures';
import type { FinanceEvent, FinancePayload } from '../src/core/finance/types';
import { seedEvents, seedMaster } from './fixtures';
import { textFit } from './text-fit';

/**
 * E03-S11 (owner 2026-11-03): screens draw the traced FarmMate originals on
 * their tiles. On the real web build, at 360 and 390 px and text size S/M/L:
 * nothing is cut off or pushed past the edge (FM-9), each screen draws at
 * least the originals it should (found by their `farmmate-art` marker, not
 * any svg: line icons are svgs too), each sits inside its tile, and each
 * stands out from its tile's colour. "Stands out": at least half of its
 * painted pixels reach 1.5:1 against the tile, i.e. its shape reads; these are
 * multi-colour pictures on a pale ground, so WCAG's 3:1 for a single-ink
 * glyph is too strict a bar for every pixel. The share at 3:1 is reported
 * too (in the test's attachment) so the lead sees the real figure (owner
 * rule 2: an original that blends in is reported). Screenshots go to docs/
 * only with UPDATE_SCREENSHOTS=1.
 */

const SHOTS = 'docs/ux/screenshots/e03-s11';

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'portrait-first'));

const FARM: MasterPayload[] = [
  { t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] },
  { t: 'person_added', personId: 'mgr', name: 'อ.สมหวัง', roles: ['manager'], otherRoles: [] },
  { t: 'person_added', personId: 'own', name: 'เจ้าของสวน', roles: ['owner'], otherRoles: [] },
  { t: 'property_added', propertyId: 'fa', name: 'จันทเขลม', crop: 'rubber' },
  { t: 'point_added', pointId: 'a1', propertyId: 'fa', name: 'จุด 1' },
  { t: 'tapper_assigned', assignmentId: 's1', pointId: 'a1', tapperId: 'red' },
];

const finEvent = (n: number, targetId: string, payload: FinancePayload): FinanceEvent => ({
  id: `e2e-art-${n}`,
  groupId: FIXTURE_GROUP_ID,
  deviceSeq: n,
  ts: Date.now(),
  actor: { userId: 'pre-login', deviceId: 'dev-seed' },
  source: 'app',
  targetId,
  baseEventId: null,
  payload,
});
const owes = (payer: { id: string; name: string }, amountSatang: number): FinancePayload => ({
  t: 'expense_created',
  fields: { amountSatang, date: '2026-10-28', stage: 'actual', categoryId: 'cat-fuel', propertyId: null, item: '', note: '', payer },
});

async function seed(page: Page) {
  await seedMaster(page, FARM);
  const b = new LogBuilder('sale-art');
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'pile_added', pileId: 'a1', zoneId: 'fa', name: 'a1', tareG: 2_000, stdNetG: 50_000 });
  for (let n = 1; n <= 3; n++) b.acceptAt('a1', n);
  await seedEvents(page, b.build().map((e) => ({ ...e, ts: Date.now() })));
  const events = [
    finEvent(1, 'x-red', owes({ id: 'red', name: 'แดง' }, 64_000)),
    finEvent(2, 'x-mgr', owes({ id: 'mgr', name: 'อ.สมหวัง' }, 40_000)),
    finEvent(3, 'x-own', owes({ id: 'own', name: 'เจ้าของสวน' }, 80_000)),
    finEvent(4, 'd-red', { t: 'debt_added', fields: { worker: { id: 'red', name: 'แดง' }, kind: 'loan', amountSatang: 300_000, date: '2026-10-01', note: '', lender: null, fertilizer: null, carriedForward: false } }),
  ];
  await page.evaluate((ev) => localStorage.setItem('mon-farm:finance-events', JSON.stringify(ev)), events);
}

interface ArtReading {
  where: string;
  size: number;
  /** Share of the icon's painted pixels with contrast ≥ 1.5:1 against its tile. */
  visible: number;
  /** The same at ≥ 3:1, reported only. */
  strong: number;
  tile: string;
  /** The icon lies inside the coloured box it sits on. */
  inside: boolean;
}

/** Every drawn original on the page (an <svg> with paths inside a coloured box), its size, and how much of it stands out from that box. */
const readArt = (page: Page) =>
  page.evaluate(async () => {
    const lum = (r: number, g: number, b: number) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const out: ArtReading[] = [];
    const svgs = [...document.querySelectorAll('[data-testid="farmmate-art"] svg')] as SVGSVGElement[];
    for (const svg of svgs) {
      const r = svg.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || getComputedStyle(svg).visibility === 'hidden') continue;
      let box: Element | null = svg.closest('[data-testid="farmmate-art"]')!.parentElement;
      while (box && ['rgba(0, 0, 0, 0)', 'transparent'].includes(getComputedStyle(box).backgroundColor)) box = box.parentElement;
      const bg = box ? getComputedStyle(box).backgroundColor : 'rgb(255, 255, 255)';
      const [br, bgG, bb] = (bg.match(/\d+/g) ?? ['255', '255', '255']).map(Number);
      const lb = lum(br, bgG, bb);
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = 96;
      const k = c.getContext('2d')!;
      k.drawImage(img, 0, 0, 96, 96);
      const px = k.getImageData(0, 0, 96, 96).data;
      let painted = 0;
      let seen = 0;
      let strong = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 200) continue;
        painted++;
        const cr = ratio(lum(px[i], px[i + 1], px[i + 2]), lb);
        if (cr >= 1.5) seen++;
        if (cr >= 3) strong++;
      }
      const host = svg.closest('[data-testid="farmmate-art"]')!.parentElement!.closest('[data-testid]');
      const b = (box ?? document.body).getBoundingClientRect();
      const inside = !box || (r.left >= b.left - 0.5 && r.right <= b.right + 0.5 && r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5);
      const share = (n: number) => (painted ? Math.round((n / painted) * 100) / 100 : 0);
      out.push({ where: host?.getAttribute('data-testid') ?? '?', size: Math.round(r.width), visible: share(seen), strong: share(strong), tile: bg, inside });
    }
    return out;
  });

const SCREENS: { name: string; min: number; open: (page: Page) => Promise<void> }[] = [
  { name: 'home', min: 5, open: async (page) => { await page.goto('/v2'); await page.getByTestId('home-open-sale').waitFor(); } },
  {
    name: 'home-modules',
    min: 6,
    open: async (page) => {
      await page.goto('/v2');
      await page.getByTestId('mod-workers').scrollIntoViewIfNeeded();
    },
  },
  { name: 'menu', min: 8, open: async (page) => { await page.goto('/v2'); await page.getByTestId('open-menu').click(); await page.getByTestId('nav-sync').waitFor(); } },
  { name: 'expense-form', min: 7, open: async (page) => { await page.goto('/v2/expense/new'); await page.getByTestId('expense-payer-row').waitFor(); } },
  { name: 'owed', min: 3, open: async (page) => { await page.goto('/v2/owed'); await page.getByTestId('owed-open-red').waitFor(); } },
  { name: 'debts', min: 1, open: async (page) => { await page.goto('/v2/debts'); await page.getByTestId('debt-account-red').waitFor(); } },
  { name: 'debt-account', min: 1, open: async (page) => { await page.goto('/v2/debt/red?name=%E0%B9%81%E0%B8%94%E0%B8%87'); await page.getByTestId('debt-plan-row').waitFor(); } },
];

for (const width of [360, 390]) {
  for (const size of ['s', 'm', 'l'] as const) {
    test(`home and money draw the originals, nothing cut off, at ${width} px text ${size}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((size) => localStorage.setItem('mon-farm:text-size', size), size);
      await seed(page);
      const low: string[] = [];
      const readings: (ArtReading & { screen: string })[] = [];
      for (const s of SCREENS) {
        await s.open(page);
        await page.waitForTimeout(150);
        expect(await textFit(page), `${s.name}: nothing cut off or past the edge`).toEqual([]);
        const art = await readArt(page);
        expect(art.length, `${s.name}: originals drawn`).toBeGreaterThanOrEqual(s.min);
        expect(art.filter((a) => !a.inside).map((a) => a.where), `${s.name}: every original inside its tile`).toEqual([]);
        for (const a of art) if (a.visible < 0.5) low.push(`${s.name} ${a.where} ${a.visible} on ${a.tile}`);
        readings.push(...art.map((a) => ({ screen: s.name, ...a })));
        if (process.env.UPDATE_SCREENSHOTS && ((width === 390 && size === 'm') || (width === 360 && size === 'l'))) {
          await page.screenshot({ path: `${SHOTS}/${s.name}-${width}-${size}.png` });
        }
      }
      await test.info().attach('art-contrast.json', { body: JSON.stringify(readings, null, 1), contentType: 'application/json' });
      // Owner rule 2: an original that blends into its tile is reported, not hidden — none do today.
      expect(low, 'originals that blend into their tile').toEqual([]);
    });
  }
}
