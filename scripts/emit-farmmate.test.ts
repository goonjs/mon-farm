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

  it('rounds coordinates to one decimal and keeps their signs', () => {
    expect(out).toContain('d="M969.8 1050L110.6 1050C110.4 1050 -0.3 1049.9 110.1 1049.8Z"');
  });

  it('has no whitespace between tags', () => {
    expect(out).not.toMatch(/>\s+</);
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
});
