/**
 * E03-S08 TS-5: every font size follows the device text size, so a screen
 * takes its sizes from the theme (`t.font.size.*`, or a number × `t.textScale`)
 * — never a bare `fontSize: 36`. The public counting numeral is the one
 * exception (sized from the screen, TS-4). `short-reading.tsx` waits for PR 139
 * (lead, 2026-11-02) and comes off this list when it is fixed.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..');
const EXEMPT = new Set(['v2/sale/public-screen.tsx', 'v2/sale/short-reading.tsx']);

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
      .flatMap((line, i) => (/fontSize:\s*\d/.test(line) ? [`${rel}:${i + 1}`] : []));
  });
  expect(found).toEqual([]);
});
