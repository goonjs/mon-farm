/**
 * E03-S08 TS-5: every font size follows the device text size, so a screen
 * takes its sizes from the theme (`t.font.size.*`, or a number × `t.textScale`)
 * — never a bare `fontSize: 36`. The public counting numeral is the one
 * exception (sized from the screen, TS-4). A conditional counts too
 * (`fontSize: typing ? 40 : 28`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..');
const EXEMPT = new Set(['v2/sale/public-screen.tsx']);
/**
 * `fontSize:` up to the next comma or brace, holding a bare number that is not
 * a ratio of a size (`size * 0.55` follows its token) and not × textScale.
 */
const fixed = (line: string) => [...line.matchAll(/fontSize:([^,}]*)/g)].some(([, v]) => /(^|[^.\w*\s])\s*\d/.test(v.replace(/\*\s*[\d.]+/g, '')) && !/textScale/.test(v));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

it('no fixed numeric fontSize outside the public numeral', () => {
  const found = files(SRC).flatMap((p) => {
    const rel = relative(SRC, p).split('\\').join('/');
    if (rel.startsWith('__tests__/') || EXEMPT.has(rel)) return [];
    return readFileSync(p, 'utf8')
      .split('\n')
      .flatMap((line, i) => (fixed(line) ? [`${rel}:${i + 1}`] : []));
  });
  expect(found).toEqual([]);
});
