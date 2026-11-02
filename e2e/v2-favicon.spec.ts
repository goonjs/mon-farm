import { expect, test, type Page } from '@playwright/test';

import { tokens } from '../design/tokens';
import { scaleSizes } from '../src/core/text-scale';
import { evidence } from './fixtures';
import { smallTargets, textFit } from './text-fit';

/**
 * E03-S10 on the real web build: the tab icon picker on เครื่องนี้ changes
 * the browser's <link rel="icon"> / apple-touch-icon at once, from PNGs drawn
 * on the device (FV-2), keeps the choice across a reload on any page (FV-3),
 * leaves the shipped favicon alone until something is chosen and puts it back
 * on เดิม (FV-4), and nothing on the card is cut off (FV-6).
 */

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'portrait-first'));

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

/** Width × height of an image data URL, decoded by the browser. */
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

test('choosing an icon changes the tab icon at once, survives a reload, and เดิม puts the shipped one back', async ({ page }) => {
  await page.goto('/v2/device');
  const card = page.getByTestId('device-favicon');
  await card.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('device-favicon-default')).toHaveAttribute('aria-checked', 'true');
  expect(await head(page)).toEqual({ icons: [{ href: '/favicon.ico', type: null }], touch: null });

  await page.getByTestId('device-favicon-sale.weigh').click();
  await expect(page.getByTestId('device-favicon-sale.weigh')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await head(page)).icons[0]?.href ?? '').toMatch(/^data:image\/png;base64,/);
  const chosen = await head(page);
  expect(chosen.icons).toHaveLength(1);
  expect(chosen.icons[0].type).toBe('image/png');
  expect(await pixelSize(page, chosen.icons[0].href)).toBe('64x64');
  expect(chosen.touch).toMatch(/^data:image\/png;base64,/);
  expect(await pixelSize(page, chosen.touch!)).toBe('180x180');
  expect(await colourCount(page, chosen.icons[0].href)).toBeGreaterThan(3);
  expect(await colourCount(page, chosen.touch!)).toBeGreaterThan(3);
  expect(await page.evaluate(() => localStorage.getItem('mon-farm:favicon'))).toBe('sale.weigh');
  await evidence(page, 'docs/ux/screenshots/e03-s10/device-picker-chosen.png');
  await tabStrip(page, chosen.icons[0].href, chosen.touch!);

  // Another page, fresh load: the app puts the choice back on start.
  await page.goto('/v2');
  await expect.poll(async () => (await head(page)).icons[0]?.href ?? '').toMatch(/^data:image\/png;base64,/);
  expect((await head(page)).icons[0].href).toBe(chosen.icons[0].href);

  await page.goto('/v2/device');
  await expect(page.getByTestId('device-favicon-sale.weigh')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('device-favicon-default').click();
  await expect.poll(() => head(page)).toEqual({ icons: [{ href: '/favicon.ico', type: null }], touch: null });
  expect(await page.evaluate(() => localStorage.getItem('mon-farm:favicon'))).toBe('default');
});

test('a device that never chose keeps the shipped favicon untouched (FV-4)', async ({ page }) => {
  await page.goto('/v2');
  await page.waitForTimeout(500);
  expect(await head(page)).toEqual({ icons: [{ href: '/favicon.ico', type: null }], touch: null });
});

for (const width of [360, 390]) {
  for (const size of ['s', 'm', 'l'] as const) {
    test(`the card fits at ${width} px, text size ${size} (FV-6)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((size) => localStorage.setItem('mon-farm:text-size', size), size);
      await page.goto('/v2/device');
      const card = page.getByTestId('device-favicon');
      await card.scrollIntoViewIfNeeded();
      await expect(page.getByTestId('device-favicon-people.commsLog')).toBeVisible();
      // The size really applied (not just the default M): the card's note is bodySm × textScale.
      const note = card.getByText(/^เฉพาะเบราว์เซอร์ในเครื่องนี้ · บุ๊กมาร์ก/);
      await expect(note).toHaveCSS('font-size', `${scaleSizes(tokens.font.size, size).bodySm}px`);
      expect(await textFit(page)).toEqual([]);
      expect(await smallTargets(page)).toEqual([]);
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      for (const id of ['default', 'nav.home', 'people.commsLog']) {
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
