import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * E01-S17: no raw colour in `src/`. Screens read semantic roles only
 * (`theme.color.<name>`, from design/tokens.ts), so a palette switch is one
 * edit and every pairing stays contrast-checked. `design/` is the one place a
 * raw colour may live and is deliberately not scanned. No allowlist, and
 * comments count too — a hex in a comment is how one creeps back into code.
 */

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const EXTENSIONS = /\.(ts|tsx|js|jsx|css|json)$/;

/** A hex colour (3/4/6/8 digits), or an rgb()/rgba()/hsl()/hsla() call, any case. */
const RAW_COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])|\b(?:rgba?|hsla?)\s*\(/i;

export function findRawColour(line: string): string | null {
  const m = RAW_COLOUR.exec(line);
  return m ? m[0] : null;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (EXTENSIONS.test(name)) out.push(path);
  }
  return out;
}

describe('raw-colour detector', () => {
  it.each([
    "'#FFF'",
    "color: '#ffffff80'",
    'rgba(0,0,0,.1)',
    'hsl(210 20% 50%)',
    'linear-gradient(180deg, #3c9ffe, #0274df)',
    'background: rgb(1, 2, 3)',
    "'#0A0B'",
    'RGB(1, 2, 3)',
    'Rgba(0,0,0,.1)',
    'HSLA(0 0% 0% / .5)',
  ])('flags %s', (line) => {
    expect(findRawColour(line)).not.toBeNull();
  });

  it.each(["'transparent'", "'#'", 'issue #12 stays prose', 'href="#top"', "testID={`#${id}`}"])(
    'ignores %s',
    (line) => {
      expect(findRawColour(line)).toBeNull();
    },
  );
});

describe('src/ has no raw colour', () => {
  it('every colour comes from theme.color.<role>', () => {
    const hits: string[] = [];
    for (const file of walk(SRC)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const found = findRawColour(line);
          if (found) hits.push(`${relative(ROOT, file)}:${i + 1}  ${found}`);
        });
    }
    expect(
      hits,
      `Raw colour in src/ — use theme.color.<name> from design/tokens.ts instead:\n  ${hits.join('\n  ')}`,
    ).toEqual([]);
  });
});
