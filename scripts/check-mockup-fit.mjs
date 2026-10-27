/**
 * Fit gate for HTML mockups (rule: nothing is cut off, see AGENTS.md
 * "No clipped content" and .claude/skills/phone-form-ux).
 *
 *   node scripts/check-mockup-fit.mjs <mockup.html> [outDir] [scale]
 *
 * Every `.phone` element is measured. It FAILS (exit 1) when, inside a phone:
 *   - the body or an open sheet is taller than its box (vertical overflow),
 *   - anything sticks out of the phone box left or right (horizontal overflow),
 *   - a box clips its own content (overflow hidden/clip with scroll size > client
 *     size), or text is cut with an ellipsis (`text-overflow: ellipsis`).
 * With `outDir` it also writes one PNG per phone (device size × scale, default 3).
 * Set CHROMIUM_PATH to use a browser other than Playwright's own.
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

const [, , html, outDir, scale = '3'] = process.argv;
if (!html) {
  console.error('usage: check-mockup-fit.mjs <mockup.html> [outDir] [scale]');
  process.exit(2);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: Number(scale) });
await page.goto('file://' + resolve(html));
await page.waitForTimeout(500);

let failed = 0;
for (const id of await page.$$eval('.phone', (els) => els.map((e) => e.id))) {
  const problems = await page.$eval('#' + id, (phone) => {
    const out = [];
    const pr = phone.getBoundingClientRect();
    for (const sel of ['.body', '.sheet']) {
      const el = phone.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight + 1) out.push(`${sel} taller than its box by ${el.scrollHeight - el.clientHeight}px`);
    }
    const name = (c) => `${c.tagName.toLowerCase()}.${String(c.className).split(' ')[0]} "${(c.textContent || '').trim().slice(0, 24)}"`;
    phone.querySelectorAll('*').forEach((c) => {
      const r = c.getBoundingClientRect();
      if (!r.width) return;
      if (r.right > pr.right + 1 || r.left < pr.left - 1) out.push(`sticks out sideways: ${name(c)}`);
      const s = getComputedStyle(c);
      if (s.textOverflow === 'ellipsis') out.push(`text cut with …: ${name(c)}`);
      if ((s.overflowX === 'hidden' || s.overflowX === 'clip') && c.scrollWidth > c.clientWidth + 1) out.push(`clips its content: ${name(c)}`);
    });
    return out;
  });
  if (problems.length) {
    failed++;
    console.log(`FAIL ${id}\n  ${[...new Set(problems)].join('\n  ')}`);
  } else console.log(`ok   ${id}`);
  if (outDir) await (await page.$('#' + id)).screenshot({ path: `${outDir}/${id}.png` });
}
await browser.close();
process.exit(failed ? 1 : 0);
