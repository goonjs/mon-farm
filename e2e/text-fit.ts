import type { Page } from '@playwright/test';

/**
 * "No clipped content" on the real build (AGENTS.md, E03-S08 TS-8): the same
 * checks as `scripts/check-mockup-fit.mjs`, against the viewport instead of a
 * mockup phone box. Returns one line per problem; [] = fits.
 *
 * - text sticking out past the screen left or right,
 * - text cut with an ellipsis (`text-overflow: ellipsis`),
 * - a box that clips its own text (overflow hidden/clip with a scroll size
 *   larger than its box).
 * Only elements holding text count (icons and the home cover drawing bleed by
 * design). Horizontal scrollers (a deliberate row of chips) are not clipping.
 */
export const textFit = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const name = (c: Element) => `${c.getAttribute('data-testid') ?? c.tagName.toLowerCase()} "${(c.textContent ?? '').trim().slice(0, 28)}"`;
    const inScroller = (c: Element) => {
      for (let p = c.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll') return true;
      }
      return false;
    };
    document.querySelectorAll('body *').forEach((c) => {
      if (c.closest('svg')) return;
      const s = getComputedStyle(c);
      if (s.visibility === 'hidden' || s.display === 'none') return;
      const r = c.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const text = (c.textContent ?? '').trim();
      if (!text) return;
      if ((r.right > innerWidth + 1 || r.left < -1) && !inScroller(c)) out.push(`sticks out ${Math.round(r.left)}→${Math.round(r.right)}: ${name(c)}`);
      if (s.textOverflow === 'ellipsis' && c.scrollWidth > c.clientWidth + 1) out.push(`cut with …: ${name(c)}`);
      const clipX = (s.overflowX === 'hidden' || s.overflowX === 'clip') && c.scrollWidth > c.clientWidth + 1;
      const clipY = (s.overflowY === 'hidden' || s.overflowY === 'clip') && c.scrollHeight > c.clientHeight + 1;
      if (clipX || clipY) out.push(`clips its text ${clipX ? 'x' : ''}${clipY ? 'y' : ''} ${c.scrollWidth}/${c.clientWidth}×${c.scrollHeight}/${c.clientHeight}: ${name(c)}`);
    });
    return [...new Set(out)];
  });

/** Touch targets under 48 px among visible buttons (design-system §12.10 #6). */
export const smallTargets = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[role="button"],[role="radio"],[role="checkbox"],[role="switch"],button,a[href]')]
      .map((b) => ({ b, r: b.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 47.5 || r.height < 47.5))
      .map(({ b, r }) => `${b.getAttribute('data-testid') ?? b.tagName} ${Math.round(r.width)}×${Math.round(r.height)}`),
  );

/**
 * Simulates a phone's own font scale on top of the app's (Android's system
 * "font size", which React Native applies to every Text): every font size and
 * line height on the page × `k`, as a static snapshot after render.
 */
export const multiplyFonts = (page: Page, k: number) =>
  page.evaluate((k) => {
    // Read every size first, then write: a child that inherits must not be multiplied twice.
    const all = [...document.querySelectorAll<HTMLElement>('body *')].filter((el) => !el.closest('svg'));
    const sizes = all.map((el) => {
      const s = getComputedStyle(el);
      return [parseFloat(s.fontSize), parseFloat(s.lineHeight)] as const;
    });
    all.forEach((el, i) => {
      const [fs, lh] = sizes[i];
      el.style.fontSize = `${fs * k}px`;
      if (!Number.isNaN(lh)) el.style.lineHeight = `${lh * k}px`;
    });
  }, k);
