import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { emitModule, minifySvg, MASTERS_DIR, OUT } from './emit-farmmate.mjs';

/**
 * The traced FarmMate originals ("ตัวสวย", design/icons/farmmate/*.svg) reach
 * the app as one generated module of SVG strings (owner 2026-11-03: the whole
 * app uses them). These tests pin the minifier and keep the generated file in
 * step with the originals, the way tokens:check keeps docs/ux/tokens.css.
 */

const sample = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1081.812 1100" width="1081.812" height="1100">
<title>sale.weigh</title>
<g id="layer-01-00AA7D" fill="#00AA7D" fill-rule="evenodd">
<path id="body" d="M969.773 1050L110.566 1050C110.411 1050 -0.289 1049.852 110.137 1049.82Z"/>
</g>
</svg>`;

describe('minifySvg', () => {
  const out = minifySvg(sample);

  it('drops the xml declaration, the title, ids and the fixed pixel size', () => {
    expect(out).not.toMatch(/<\?xml|<title|\sid=|\swidth=|\sheight=/);
  });

  it('keeps the viewBox, the colours and the fill rule', () => {
    expect(out).toContain('viewBox="0 0 1081.8 1100"');
    expect(out).toContain('fill="#00AA7D"');
    expect(out).toContain('fill-rule="evenodd"');
  });

  // PR 5 (owner 2026-11-03): path data to whole units (~60 KB gzip less). Every path is absolute (M L C Z), so the error
  // does not add up: at most half a unit of a ~1100 viewBox, 0.02 px at 48 px. The viewBox keeps one decimal.
  it('rounds path data to whole units and keeps their signs', () => {
    expect(out).toContain('d="M970 1050L111 1050C110 1050 -0 1050 110 1050Z"');
  });

  it('has no whitespace between tags', () => {
    expect(out).not.toMatch(/>\s+</);
  });

  // Review of PR 145: compact path data from other tracers.
  it('keeps the minus that separates two numbers when one rounds to zero', () => {
    expect(minifySvg('<svg viewBox="0 0 10 10"><path d="M5.5-0.04L10-0.03"/></svg>')).toContain('d="M6-0L10-0"');
  });

  it('rounds only path data and the viewBox, nothing else', () => {
    const svg = '<svg viewBox="0 0 10.25 10"><g fill="#00AA7D" fill-opacity="0.25"><path d="M.25.75L1.26 2"/></g></svg>';
    const min = minifySvg(svg);
    expect(min).toContain('viewBox="0 0 10.3 10"');
    expect(min).toContain('fill-opacity="0.25"');
    expect(min).toContain('d="M0 1L1 2"');
  });

  // Review round 2: a number rounding to a whole value must keep the dot that ends it when the next number starts with one.
  it('keeps two numbers apart when the first rounds to a whole value and the next starts with a dot', () => {
    expect(minifySvg('<svg viewBox="0 0 10 10"><path d="M1.96.5L.04.5L-0.04.5"/></svg>')).toContain('d="M2 1L0 1L-0 1"');
  });

  // Review round 3: the next number's own leading dot was its only separator.
  it('keeps a number that starts with a dot apart from the one before it', () => {
    expect(minifySvg('<svg viewBox="0 0 10 10"><path d="M1.5.96L1.5.04L1.96.96.5"/></svg>')).toContain('d="M2 1L2 0L2 1 1"');
  });

  it('drops comments', () => {
    expect(minifySvg('<svg viewBox="0 0 10 10"><!-- traced --><path d="M0 0"/></svg>')).not.toContain('<!--');
  });

  it('drops the pixel size from the root svg only', () => {
    const min = minifySvg('<svg viewBox="0 0 10 10" width="10" height="10"><g width="3" height="4"><path d="M0 0"/></g></svg>');
    expect(min).toContain('<svg viewBox="0 0 10 10">');
    expect(min).toContain('<g width="3" height="4">');
  });

  it('refuses what it cannot keep exact: exponents, and elements other than svg, g and path', () => {
    expect(() => minifySvg('<svg viewBox="0 0 10 10"><path d="M1e2 0"/></svg>')).toThrow(/exponent/);
    expect(() => minifySvg('<svg viewBox="0 0 10 10"><path d="M1.e5 0"/></svg>')).toThrow(/exponent/);
    expect(() => minifySvg('<svg viewBox="0 0 10 10"><rect width="3" height="3"/></svg>')).toThrow(/<rect>/);
  });
});

describe('design/icons/farmmate-masters.ts', () => {
  const ids = readdirSync(MASTERS_DIR)
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.slice(0, -4))
    .sort();

  it('is up to date with design/icons/farmmate (run `npm run icons` after changing an original)', () => {
    expect(readFileSync(OUT, 'utf8')).toBe(emitModule());
  });

  it('holds every icon of the manifest', () => {
    const manifest = JSON.parse(readFileSync(join(MASTERS_DIR, 'manifest.json'), 'utf8')) as { id: string }[];
    expect(manifest.map((m) => m.id).sort()).toEqual(ids);
    const generated = emitModule();
    for (const id of ids) expect(generated).toContain(`'${id}': '<svg`);
  });

  it('carries each icon\'s Thai label from the manifest, for the catalogue page', () => {
    const manifest = JSON.parse(readFileSync(join(MASTERS_DIR, 'manifest.json'), 'utf8')) as { id: string; labelTh: string }[];
    const generated = emitModule();
    for (const m of manifest) expect(generated).toContain(`'${m.id}': '${m.labelTh}',`);
  });

  it('types the ids, so a misspelt icon id does not compile', () => {
    expect(emitModule()).toContain('export type FarmMateArtId = keyof typeof FARMMATE_MASTERS;');
  });
});
