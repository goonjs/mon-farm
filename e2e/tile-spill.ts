import type { Page } from '@playwright/test';

/**
 * Text spilling out of its own tile (review of PR 255, B1). `textFit` only sees
 * hidden/clipped overflow, "…" and the screen's left/right edges, so a label
 * that runs visibly past the bottom of a fixed-height tile, over the next row,
 * still passes it. Here every visible tile, row or button whose content is
 * larger than its own box counts, whether or not the overflow is visible.
 * Returns one line per problem; [] = every tile holds its text.
 *
 * Used only by the E01-S25/S26 size tests added in PR 255, next to `textFit`
 * and `smallTargets`; the shared helpers in text-fit.ts are unchanged.
 */
export const tileSpill = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[role="radio"],[role="checkbox"],[role="button"],[role="switch"]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && (el.textContent ?? '').trim() !== '';
      })
      .filter((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.getAttribute('data-testid') ?? el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 28)}" content ${el.scrollWidth}×${el.scrollHeight} in ${el.clientWidth}×${el.clientHeight}`),
  );
