import { expect, test, type Page } from './test';

import { tokens } from '../design/tokens';
import { scaleSizes } from '../src/core/text-scale';
import { evidence } from './fixtures';
import { smallTargets, textFit } from './text-fit';

/**
 * E03-S10 on the real web build: the tab icon picker on เครื่องนี้ changes
 * the browser's <link rel="icon"> / apple-touch-icon at once, to PNGs that ship
 * with the build (FV-2), keeps the choice across a reload on any page (FV-3),
 * shows กรีดยาง when nothing was chosen (FV-4, owner 2026-11-02: no Expo icon),
 * and nothing on the card is cut off (FV-6).
 */

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'portrait-first'));

/** The PNGs ship with the build, served from the app's own /assets (FV-2). */
const png = (id: string, size: number) => new RegExp(`^/assets/assets/favicons/${id.replace('.', '\\.')}-${size}\\.[0-9a-f]+\\.png$`);

const head = (page: Page) =>
  page.evaluate(() => ({
    icons: [...document.querySelectorAll('link[rel~="icon"]')].map((l) => ({ href: l.getAttribute('href') ?? '', type: l.getAttribute('type') })),
    touch: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ?? null,
  }));

/**
 * How many distinct colours the image has, drawn by the browser: a blank
 * canvas (drawn before the SVG decoded) or a bare tile has 1–2 (review #5).
 */
const colourCount = (page: Page, src: string) =>
  page.evaluate(
    (src) =>
      new Promise<number>((ok) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          const d = ctx.getImageData(0, 0, c.width, c.height).data;
          const seen = new Set<number>();
          for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3]);
          ok(seen.size);
        };
        img.onerror = () => ok(0);
        img.src = src;
      }),
    src,
  );

/** Mean absolute RGBA difference (0–255) of two images, both drawn at 32 × 32. */
const meanDiff = (page: Page, a: string, b: string) =>
  page.evaluate(
    async ([a, b]) => {
      const pixels = (src: string) =>
        new Promise<Uint8ClampedArray>((ok, fail) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = 32;
            c.height = 32;
            const ctx = c.getContext('2d')!;
            ctx.drawImage(img, 0, 0, 32, 32);
            ok(ctx.getImageData(0, 0, 32, 32).data);
          };
          img.onerror = () => fail(new Error(`cannot load ${src}`));
          img.src = src;
        });
      const [p, q] = await Promise.all([pixels(a), pixels(b)]);
      let sum = 0;
      for (let i = 0; i < p.length; i++) sum += Math.abs(p[i] - q[i]);
      return sum / p.length;
    },
    [a, b] as const,
  );

/** Width × height of an image URL, decoded by the browser. */
const pixelSize = (page: Page, src: string) =>
  page.evaluate(
    (src) =>
      new Promise<string>((ok) => {
        const img = new Image();
        img.onload = () => ok(`${img.naturalWidth}x${img.naturalHeight}`);
        img.onerror = () => ok('broken');
        img.src = src;
      }),
    src,
  );

test('choosing an icon changes the tab icon at once and survives a reload on another page (FV-2, FV-3)', async ({ page }) => {
  await page.goto('/v2/device');
  const card = page.getByTestId('device-favicon');
  await card.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('device-favicon-farmwork.tapping')).toHaveAttribute('aria-checked', 'true');

  await page.getByTestId('device-favicon-sale.weigh').click();
  await expect(page.getByTestId('device-favicon-sale.weigh')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await head(page)).icons[0]?.href ?? '').toMatch(png('sale.weigh', 64));
  const chosen = await head(page);
  expect(chosen.icons).toHaveLength(1);
  expect(chosen.icons[0].type).toBe('image/png');
  expect(await pixelSize(page, chosen.icons[0].href)).toBe('64x64');
  expect(chosen.touch).toMatch(png('sale.weigh', 180));
  expect(await pixelSize(page, chosen.touch!)).toBe('180x180');
  expect(await colourCount(page, chosen.icons[0].href)).toBeGreaterThan(3);
  expect(await colourCount(page, chosen.touch!)).toBeGreaterThan(3);
  expect(await page.evaluate(() => localStorage.getItem('mon-farm:favicon'))).toBe('sale.weigh');

  // Another page, fresh load: the app puts the choice back on start.
  await page.goto('/v2');
  await expect.poll(async () => (await head(page)).icons[0]?.href ?? '').toMatch(png('sale.weigh', 64));

  await page.goto('/v2/device');
  await expect(page.getByTestId('device-favicon-sale.weigh')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('device-favicon-farmwork.tapping').click();
  await expect.poll(async () => (await head(page)).icons[0]?.href ?? '').toMatch(png('farmwork.tapping', 64));
  expect(await page.evaluate(() => localStorage.getItem('mon-farm:favicon'))).toBe('farmwork.tapping');
});

// Owner 2026-11-02: no Expo icon; กรีดยาง is the default.
test('a device that never chose shows กรีดยาง: in the shipped page, then as PNGs with a home-screen icon (FV-4)', async ({ page, request }) => {
  // The static HTML's /favicon.ico is built from the กรีดยาง PNG (app.json), not Expo's.
  const shipped = await (await request.get('/v2')).text();
  expect(shipped).toContain('<link rel="icon" href="/favicon.ico"');
  await page.goto('/v2');
  expect(await colourCount(page, '/favicon.ico')).toBeGreaterThan(3);
  await expect.poll(async () => (await head(page)).icons[0]?.href ?? '').toMatch(png('farmwork.tapping', 64));
  const h = await head(page);
  // …and the shipped /favicon.ico is กรีดยาง, not Expo's icon: the same picture as
  // the tapping PNG when both are drawn at 32 px (review round 2 #4).
  expect(await meanDiff(page, '/favicon.ico', h.icons[0].href)).toBeLessThan(25);
  expect(h.touch).toMatch(png('farmwork.tapping', 180));
  expect(await colourCount(page, h.icons[0].href)).toBeGreaterThan(3);
  await tabStrip(page, new URL(h.icons[0].href, page.url()).href, new URL(h.touch!, page.url()).href);
  await page.goto('/v2/device');
  await page.getByTestId('device-favicon').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('device-favicon-farmwork.tapping')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('device-favicon-default')).toHaveCount(0);
  await evidence(page, 'docs/ux/screenshots/e03-s10/device-picker-chosen.png');
});

for (const width of [360, 390]) {
  for (const size of ['s', 'm', 'l'] as const) {
    test(`the card fits at ${width} px, text size ${size} (FV-6)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((size) => localStorage.setItem('mon-farm:text-size', size), size);
      await page.goto('/v2/device');
      const card = page.getByTestId('device-favicon');
      await card.scrollIntoViewIfNeeded();
      await expect(page.getByTestId('device-favicon-system.sync')).toBeVisible();
      // The size really applied (not just the default M): the card's note is bodySm × textScale.
      const note = card.getByText(/^เฉพาะเบราว์เซอร์ในเครื่องนี้ · บุ๊กมาร์ก/);
      await expect(note).toHaveCSS('font-size', `${scaleSizes(tokens.font.size, size).bodySm}px`);
      expect(await textFit(page)).toEqual([]);
      expect(await smallTargets(page)).toEqual([]);
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      for (const id of ['farmwork.tapping', 'nav.home', 'system.sync']) {
        const b = (await page.getByTestId(`device-favicon-${id}`).boundingBox())!;
        expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width);
      }
      expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= innerWidth)).toBe(true);
      await card.screenshot({ path: test.info().outputPath(`card-${width}-${size}.png`) });
      if (process.env.UPDATE_SCREENSHOTS) await card.screenshot({ path: `docs/ux/screenshots/e03-s10/card-${width}-${size}.png` });
    });
  }
}

/**
 * Evidence only: headless Chromium has no tab strip to photograph, so draw one
 * — light and dark — with the exact icon the page set, at the 16 px a tab uses,
 * and the 180 px home-screen icon beside it.
 */
async function tabStrip(page: Page, icon: string, touch: string) {
  if (!process.env.UPDATE_SCREENSHOTS) return;
  const strip = await page.context().newPage();
  await strip.setViewportSize({ width: 390, height: 260 });
  const tab = (bg: string, fg: string, tabBg: string) =>
    `<div style="background:${bg};padding:8px 8px 0;display:flex;gap:4px">
       <div style="background:${tabBg};color:${fg};border-radius:8px 8px 0 0;padding:8px 12px;display:flex;align-items:center;gap:8px;font:13px sans-serif;width:200px">
         <img src="${icon}" width="16" height="16"><span>mon-farm</span></div></div>`;
  await strip.setContent(
    `<body style="margin:0;font:12px sans-serif">${tab('#dee1e6', '#202124', '#ffffff')}${tab('#202124', '#e8eaed', '#35363a')}
     <div style="padding:12px;display:flex;align-items:center;gap:12px"><img src="${touch}" width="90" height="90" style="border-radius:20px">
     <span>ไอคอนหน้าจอโฮม (apple-touch-icon 180 px)</span></div>
     <div style="padding:0 12px;color:#666">จำลองแถบแท็บ ด้วยไอคอนที่แอปตั้งให้จริง</div></body>`,
  );
  await strip.screenshot({ path: 'docs/ux/screenshots/e03-s10/tab-strip.png' });
  await strip.close();
}

/**
 * Owner 2026-11-02, same PR: the last item on เครื่องนี้ opens the icon
 * catalogue; it sits apart from the settings and nothing on it is cut off.
 */
for (const width of [360, 390]) {
  for (const size of ['s', 'm', 'l'] as const) {
    test(`the view-only icon link fits at ${width} px, text size ${size}, and opens the catalogue`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((size) => localStorage.setItem('mon-farm:text-size', size), size);
      await page.goto('/v2/device');
      const row = page.getByTestId('device-dev-icons');
      await row.scrollIntoViewIfNeeded();
      await expect(page.getByText('ดูอย่างเดียว', { exact: true })).toBeVisible();
      expect(await textFit(page)).toEqual([]);
      expect(await smallTargets(page)).toEqual([]);
      const box = (await row.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      // The last thing on the page: nothing below the row but padding.
      const below = await page.evaluate(() => {
        const r = document.querySelector('[data-testid="device-dev-icons"]')!.getBoundingClientRect();
        return [...document.querySelectorAll('[data-testid^="device-"]')].filter((e) => e.getBoundingClientRect().top > r.bottom).length;
      });
      expect(below).toBe(0);
      if (process.env.UPDATE_SCREENSHOTS) await page.screenshot({ path: `docs/ux/screenshots/e03-s10/dev-icons-link-${width}-${size}.png` });
      if (process.env.UPDATE_SCREENSHOTS) await row.screenshot({ path: `docs/ux/screenshots/e03-s11/dev-icons-link-${width}-${size}.png` });

      await row.click();
      await expect(page).toHaveURL(/\/v2\/dev\/icons$/);
      await expect(page.getByTestId('dev-icon-nav.home')).toBeVisible();
      expect(await textFit(page)).toEqual([]);
      // E03-S11 FM-3/FM-5: all 72 traced originals, each drawn (painted paths, its full size) inside its card, none past the screen edge.
      const cards = await page.evaluate((width) => {
        const out = { count: 0, problems: [] as string[] };
        for (const card of document.querySelectorAll('[data-testid^="dev-icon-"]')) {
          out.count++;
          const id = card.getAttribute('data-testid');
          const svg = card.querySelector('svg');
          const c = card.getBoundingClientRect();
          if (!svg || svg.querySelectorAll('path').length === 0) out.problems.push(`${id}: not drawn`);
          else {
            const r = svg.getBoundingClientRect();
            if (Math.round(r.width) !== 48 || Math.round(r.height) !== 48 || r.left < c.left || r.right > c.right) out.problems.push(`${id}: icon ${r.width}×${r.height}px or outside its card`);
            // Review of PR 145: the icon's source must not ride along as a DOM attribute.
            if (svg.hasAttribute('xml')) out.problems.push(`${id}: svg carries its source as an attribute`);
          }
          if (c.right > width + 1) out.problems.push(`${id}: past the screen edge`);
        }
        return out;
      }, width);
      expect(cards).toEqual({ count: 72, problems: [] });
      if (process.env.UPDATE_SCREENSHOTS && width === 360 && size === 'l') await evidence(page, 'docs/ux/screenshots/e03-s10/dev-icons-page-360-l.png');
      if (process.env.UPDATE_SCREENSHOTS) await page.screenshot({ path: `docs/ux/screenshots/e03-s11/dev-icons-page-${width}-${size}.png` });
    });
  }
}
