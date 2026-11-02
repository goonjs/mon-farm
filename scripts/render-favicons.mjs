#!/usr/bin/env node
/**
 * E03-S10 (owner 2026-11-02: use the traced FarmMate originals, not the
 * simplified in-app redraw): renders design/icons/farmmate/<id>.svg to the
 * PNGs the tab-icon picker ships in assets/favicons/:
 *
 *   <id>-64.png   tab icon: icon on a light rounded tile (shows on dark tab strips)
 *   <id>-180.png  home-screen icon (apple-touch-icon): full square light tile
 *   <id>-128.png  the picker's own grid: the icon alone, transparent
 *
 * The icon is cropped to its real painted pixels (alpha bounds, strokes
 * included) so it is as large as it can be at 16 px. Rendering happens here,
 * once, in Chromium — the app only shows finished PNGs, so nothing is drawn or
 * fetched at run time.
 *
 * Usage:
 *   node scripts/render-favicons.mjs                 every id src/ui/favicon/pngs.web.ts lists
 *   node scripts/render-favicons.mjs --preview <png> contact sheet of all 72 at 16/32 px
 * Chromium: CHROMIUM_PATH=/opt/pw-browsers/chromium if Playwright's own is not installed.
 */

import { Buffer } from 'node:buffer';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'design/icons/farmmate');
const OUT = join(ROOT, 'assets/favicons');
const CHOICES = join(ROOT, 'src/ui/favicon/pngs.web.ts');
/** design/tokens.ts color.light.surfaceRaised — the tile. */
const TILE = '#ffffff';

/** The ids pngs.web.ts requires PNGs for (its `require('…/<id>-64.png')` lines). */
export function listedIds(source) {
  return [...source.matchAll(/assets\/favicons\/([\w.]+)-64\.png/g)].map((m) => m[1]);
}

const svgUrl = (id) => 'data:image/svg+xml;base64,' + readFileSync(join(SRC, `${id}.svg`)).toString('base64');

/** In the page: draws one SVG and returns PNG data URLs for the three outputs. */
function renderInPage({ url, tile }) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('svg did not load'));
    img.onload = () => {
      const S = 1024;
      const scale = S / Math.max(img.naturalWidth, img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      const big = document.createElement('canvas');
      big.width = S;
      big.height = S;
      const g = big.getContext('2d');
      g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      const px = g.getImageData(0, 0, S, S).data;
      let x0 = S, y0 = S, x1 = -1, y1 = -1;
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++)
          if (px[(y * S + x) * 4 + 3] > 8) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      if (x1 < 0) {
        reject(new Error('nothing painted'));
        return;
      }
      const cw = x1 - x0 + 1;
      const ch = y1 - y0 + 1;
      const out = (size, inset, background, radius) => {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const k = c.getContext('2d');
        k.imageSmoothingQuality = 'high';
        if (background) {
          k.fillStyle = background;
          k.beginPath();
          k.roundRect(0, 0, size, size, radius);
          k.fill();
        }
        const room = size - inset * 2;
        const f = room / Math.max(cw, ch);
        k.drawImage(big, x0, y0, cw, ch, (size - cw * f) / 2, (size - ch * f) / 2, cw * f, ch * f);
        return c.toDataURL('image/png');
      };
      resolve({
        tab: out(64, 4, tile, 13),
        home: out(180, 26, tile, 0),
        grid: out(128, 0, null, 0),
      });
    };
    img.src = url;
  });
}

async function main() {
  const args = process.argv.slice(2);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  const png = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');

  if (args[0] === '--preview') {
    const ids = readdirSync(SRC).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4));
    const cells = [];
    for (const id of ids) {
      const r = await page.evaluate(renderInPage, { url: svgUrl(id), tile: TILE });
      cells.push(
        `<div class=c><img src="${r.tab}" width=16><img src="${r.tab}" width=32><span class=d><img src="${r.tab}" width=16><img src="${r.tab}" width=32></span><span>${id}</span></div>`,
      );
    }
    await page.setViewportSize({ width: 1200, height: 400 });
    await page.setContent(
      `<style>body{font:11px sans-serif;margin:8px;display:grid;grid-template-columns:repeat(4,1fr);gap:4px}.c{display:flex;align-items:center;gap:6px;border:1px solid #ddd;padding:3px}.d{background:#35363a;padding:3px;display:flex;gap:6px;align-items:center}</style>${cells.join('')}`,
    );
    await page.screenshot({ path: args[1], fullPage: true });
  } else {
    const ids = listedIds(readFileSync(CHOICES, 'utf8'));
    if (ids.length === 0) throw new Error('no ids found in src/ui/favicon/pngs.web.ts');
    mkdirSync(OUT, { recursive: true });
    for (const id of ids) {
      const r = await page.evaluate(renderInPage, { url: svgUrl(id), tile: TILE });
      writeFileSync(join(OUT, `${id}-64.png`), png(r.tab));
      writeFileSync(join(OUT, `${id}-180.png`), png(r.home));
      writeFileSync(join(OUT, `${id}-128.png`), png(r.grid));
    }
    console.log(`rendered ${ids.length} icons × 3 into assets/favicons`);
  }
  await browser.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
