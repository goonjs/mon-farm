import { expect, test } from '@playwright/test';

import { tokens } from '../design/tokens';
import { openPileScenario, seedSale, testSaleId } from './fixtures';

/**
 * The F-22 short-basket input: opens below the stage (never over it), the
 * three input modes (typed / ± / drag) stay in sync, and only "confirm"
 * writes anything.
 */

async function openCounter(page: import('@playwright/test').Page, standardBaskets = 5) {
  const saleId = testSaleId('short');
  await seedSale(page, saleId, openPileScenario(saleId, standardBaskets));
  await page.goto(`/sale/${saleId}/counter`);
  await expect(page.getByTestId('count')).toBeVisible();
}

test('opening the panel never covers the count', async ({ page }) => {
  await openCounter(page);

  await page.getByTestId('short').click();
  await expect(page.getByTestId('short-basket-panel')).toBeVisible();

  // The stage may legitimately shrink to make room (it's flex:1 above a now-
  // taller sibling column), but the panel must never overlap the numeral —
  // that's the actual F-13 requirement, not that the stage stays a fixed size.
  const countBox = (await page.getByTestId('count').boundingBox())!;
  const panelBox = (await page.getByTestId('short-basket-panel').boundingBox())!;
  expect(panelBox.y).toBeGreaterThanOrEqual(countBox.y + countBox.height);
});

test('typing a reading updates the live net preview', async ({ page }) => {
  await openCounter(page);
  await page.getByTestId('short').click();

  await page.getByTestId('short-reading-typed').fill('43');
  // demo pile: tare 2 kg -> 43 - 2 = 41 kg net
  await expect(page.getByTestId('short-preview')).toContainText('41');
});

test('confirm logs exactly the entered reading; cancel logs nothing', async ({ page }) => {
  await openCounter(page, 5);
  const before = await page.getByTestId('count').textContent();

  await page.getByTestId('short').click();
  await page.getByTestId('short-cancel').click();
  await expect(page.getByTestId('short-basket-panel')).toHaveCount(0);
  await expect(page.getByTestId('count')).toHaveText(before!); // cancel changed nothing

  await page.getByTestId('short').click();
  await page.getByTestId('short-reading-typed').fill('43');
  await page.getByTestId('short-confirm').click();

  await expect(page.getByTestId('short-basket-panel')).toHaveCount(0);
  await expect(page.getByTestId('count')).toHaveText(String(Number(before) + 1));

  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).toContainText('เข่งไม่เต็ม');
  await expect(page.getByTestId('log')).toContainText('41'); // the net that was logged
});

test('plus and minus buttons move the reading by 0.5 kg', async ({ page }) => {
  await openCounter(page);
  await page.getByTestId('short').click();
  await page.getByTestId('short-reading-typed').fill('40');

  await page.getByTestId('short-reading-plus').click();
  await expect(page.getByTestId('short-reading-typed')).toHaveValue('40.5');

  await page.getByTestId('short-reading-minus').click();
  await page.getByTestId('short-reading-minus').click();
  await expect(page.getByTestId('short-reading-typed')).toHaveValue('39.5');
});

/**
 * S22 — the short figure in the operator register, in the real build.
 *
 * The component tier already proves the arithmetic and the zero case; what
 * only a browser can show is that the line is genuinely on the Count tab of
 * the exported build, and that it stays out of the public numeral's space
 * (F-9.7) rather than merely being positioned to look like it does.
 */
test('the operator register carries the pile short weight, summed, and gives it back on undo', async ({
  page,
}, testInfo) => {
  await openCounter(page, 5);
  await expect(page.getByTestId('short-so-far')).toHaveCount(0); // nothing shorted yet
  const numeralBefore = (await page.getByTestId('count').boundingBox())!;

  await page.getByTestId('short').click();
  await page.getByTestId('short-reading-typed').fill('14.4');
  await page.getByTestId('short-confirm').click();

  // 14.4 − 2 = 12.4 kg, one short basket.
  const line = page.getByTestId('short-so-far');
  await expect(line).toBeVisible();
  await expect(line).toContainText('12.4');
  await expect(line).toContainText('1 เข่งไม่เต็ม');

  // It shares the CAPTION's strip and nothing else (F-9.7): it sits BESIDE the
  // caption on the same row (it used to sit under it, which cost the numeral
  // its clearance — see the clearance test below), and the public numeral is
  // the same size in the same place it was before the line existed, so the
  // line neither pushes nor resizes it.
  const captionBox = (await page.getByTestId('caption').boundingBox())!;
  const lineBox = (await line.boundingBox())!;
  expect(lineBox.x).toBeGreaterThanOrEqual(captionBox.x + captionBox.width);
  expect(lineBox.y + lineBox.height).toBeLessThanOrEqual(captionBox.y + captionBox.height + 1);
  expect(await page.getByTestId('count').boundingBox()).toEqual(numeralBefore);

  await page.getByTestId('short').click();
  await page.getByTestId('short-reading-typed').fill('10');
  await page.getByTestId('short-confirm').click();

  // The SUM — 12.4 + 8 — not the basket most recently logged.
  await expect(line).toContainText('20.4');
  await expect(line).toContainText('2 เข่งไม่เต็ม');
  await page.screenshot({
    path: `docs/ux/screenshots/${testInfo.project.name}/counter-short-so-far.png`,
  });

  // Undoing that second short basket takes its weight straight back out.
  await page.getByTestId('undo').click();
  await page.getByTestId('undo-confirm').click();
  await expect(line).toContainText('12.4');
  await expect(line).toContainText('1 เข่งไม่เต็ม');

  // And undoing the last one leaves no line at all.
  await page.getByTestId('undo').click();
  await page.getByTestId('undo-confirm').click();
  await expect(page.getByTestId('short-so-far')).toHaveCount(0);
});

/**
 * S22 finding 1 — the register strip must MAKE room, not eat it.
 *
 * The assertion above (the numeral's box is identical before and after) is
 * true and stays true even when the register grows, because what a second
 * register line moves is the CAPTION, upward into the numeral's line-box
 * slack — the box never budges. QA measured the consequence by hand: the gap
 * between the numeral's ink and the caption fell from ~20px to ~2px at
 * 844×390 and from ~18.5px to ~0.5px at the 740×360 floor. Nothing overlapped,
 * so every existing check passed while F-9.7's safety margin was gone.
 *
 * So this measures the thing that actually moved: the clearance between the
 * bottom of the numeral's INK (the drawn glyph, not its line box, which is
 * taller and which the caption has always sat inside) and the top of the
 * operator register. The floor is one micro line — the register's own font
 * size — so the strip can gain a full line's worth of height from a larger OS
 * text scale, or a face whose digits sit lower in the em box, before anything
 * lands on the public numeral.
 */
async function registerClearance(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const numeral = q('count');
    if (!numeral) throw new Error('no numeral');

    // Where the ink ends. The element's box is the LINE box (lineHeight), so
    // the baseline is derived from the face's own metrics and the ink's
    // descent is read off the glyphs the browser actually drew.
    const box = numeral.getBoundingClientRect();
    const cs = getComputedStyle(numeral);
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = ctx.measureText(numeral.textContent ?? '');
    const contentHeight = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
    const baseline = box.top + (box.height - contentHeight) / 2 + m.fontBoundingBoxAscent;
    const inkBottom = baseline + m.actualBoundingBoxDescent;

    const strip = [q('caption'), q('short-so-far')]
      .filter((el): el is HTMLElement => el !== null)
      .map((el) => el.getBoundingClientRect().top);
    if (strip.length === 0) throw new Error('no operator register');

    return { inkBottom, registerTop: Math.min(...strip), clearance: Math.min(...strip) - inkBottom };
  });
}

test('the register keeps its distance from the public numeral (F-9.7)', async ({ page }, testInfo) => {
  await openCounter(page, 5);

  const floor = tokens.font.size.micro; // one micro line of slack, justified above
  const before = await registerClearance(page);
  expect(before.clearance, `clearance with no short line (${testInfo.project.name})`).toBeGreaterThanOrEqual(floor);

  // One short basket: the register gains a figure. It must take that space out
  // of its own row, not out of the numeral's margin.
  await page.getByTestId('short').click();
  await page.getByTestId('short-reading-typed').fill('14.4');
  await page.getByTestId('short-confirm').click();
  await expect(page.getByTestId('short-so-far')).toBeVisible();

  const after = await registerClearance(page);
  expect(after.clearance, `clearance with the short line (${testInfo.project.name})`).toBeGreaterThanOrEqual(floor);

  // And a second short basket (a wider line, more digits) changes nothing.
  await page.getByTestId('short').click();
  await page.getByTestId('short-reading-typed').fill('10');
  await page.getByTestId('short-confirm').click();
  await expect(page.getByTestId('short-so-far')).toContainText('20.4');
  const summed = await registerClearance(page);
  expect(summed.clearance, `clearance at two short baskets (${testInfo.project.name})`).toBeGreaterThanOrEqual(floor);
});
