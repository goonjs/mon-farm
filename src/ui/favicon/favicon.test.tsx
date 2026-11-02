/**
 * E03-S10 favicon picker: the 20 choices and their pre-rendered PNGs in the
 * web bundle (FV-1, FV-2) and the device setting (FV-3: `mon-farm:favicon`,
 * unknown → the default, กรีดยาง).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FAVICON_CHOICES, FAVICON_DEFAULT, faviconLabel } from './choices';
import { FAVICON_PNGS } from './pngs.web';
import { readFavicon, writeFavicon } from './preference';

const stored = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => void stored.set(k, v),
  },
});
beforeEach(() => stored.clear());

describe('favicon choices (FV-1)', () => {
  // Owner 2026-11-02: the traced FarmMate originals (design/icons/farmmate),
  // pre-rendered to PNG by scripts/render-favicons.mjs — not the simplified
  // in-app redraw in src/ui/farmmate-icons.
  const ROOT = join(__dirname, '../../..');
  const pngSize = (file: string) => {
    const b = readFileSync(join(ROOT, 'assets/favicons', file));
    return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
  };

  it('offers 20 different icons, each one of the traced originals, with a Thai name', () => {
    expect(FAVICON_CHOICES).toHaveLength(20);
    expect(new Set(FAVICON_CHOICES).size).toBe(20);
    const manifest = JSON.parse(readFileSync(join(ROOT, 'design/icons/farmmate/manifest.json'), 'utf8')) as { id: string; labelTh: string }[];
    for (const id of FAVICON_CHOICES) {
      expect(existsSync(join(ROOT, `design/icons/farmmate/${id}.svg`))).toBe(true);
      expect(faviconLabel(id)).toBe(manifest.find((m) => m.id === id)!.labelTh);
    }
  });

  it.each(FAVICON_CHOICES)('%s has its three PNGs in the bundle at the right sizes', (id) => {
    expect(pngSize(`${id}-64.png`)).toBe('64x64');
    expect(pngSize(`${id}-180.png`)).toBe('180x180');
    expect(pngSize(`${id}-128.png`)).toBe('128x128');
    expect(FAVICON_PNGS[id].tab).toEqual({ testUri: `../../../assets/favicons/${id}-64.png` });
    expect(FAVICON_PNGS[id].home).toEqual({ testUri: `../../../assets/favicons/${id}-180.png` });
    expect(FAVICON_PNGS[id].grid).toEqual({ testUri: `../../../assets/favicons/${id}-128.png` });
  });

  it('the render script finds exactly the ids the app lists (it reads the -64 require lines)', () => {
    const script = readFileSync(join(ROOT, 'scripts/render-favicons.mjs'), 'utf8');
    expect(script).toContain('assets\\/favicons\\/([\\w.]+)-64\\.png');
    const listed = [...readFileSync(join(ROOT, 'src/ui/favicon/pngs.web.ts'), 'utf8').matchAll(/assets\/favicons\/([\w.]+)-64\.png/g)].map((m) => m[1]);
    expect(listed).toEqual([...FAVICON_CHOICES]);
  });

  it('has nothing for an unknown id', () => {
    expect(Object.hasOwn(FAVICON_PNGS, 'nope.nope')).toBe(false);
    expect(faviconLabel('nope.nope')).toBeUndefined();
  });

  // Review round 2 #1: the Android / iOS build must not carry the 60 PNGs
  // (~450 KB) for a card it never shows. Only `*.web.*` files may require them.
  it('only web files require the favicon PNGs; native gets an empty table', () => {
    expect(readFileSync(join(ROOT, 'src/ui/favicon/pngs.ts'), 'utf8')).toContain('FAVICON_PNGS: Readonly<Record<string, FaviconPngs>> = {};');
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
    const offenders = files(join(ROOT, 'src'))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.web\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => /assets\/favicons\//.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  // Owner 2026-11-02: no Expo icon; กรีดยาง is the default, and the build ships it
  // as the page's own favicon so the tab shows it before any script runs.
  it('defaults to กรีดยาง, one of the choices, and the build ships it as the favicon', () => {
    expect(FAVICON_DEFAULT).toBe('farmwork.tapping');
    expect(FAVICON_CHOICES).toContain(FAVICON_DEFAULT);
    const app = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8')) as { expo: { web: { favicon: string } } };
    expect(app.expo.web.favicon).toBe('./assets/favicons/farmwork.tapping-64.png');
  });
});

describe('favicon device setting (FV-3)', () => {
  it('defaults to กรีดยาง', () => {
    expect(readFavicon()).toBe(FAVICON_DEFAULT);
  });

  it('remembers a choice under mon-farm:favicon', () => {
    writeFavicon('sale.weigh');
    expect(stored.get('mon-farm:favicon')).toBe('sale.weigh');
    expect(readFavicon()).toBe('sale.weigh');
  });

  it('reads an unknown or removed icon id as the default — also the old "default" (เดิม) value', () => {
    stored.set('mon-farm:favicon', 'farm.gone');
    expect(readFavicon()).toBe(FAVICON_DEFAULT);
    stored.set('mon-farm:favicon', 'default');
    expect(readFavicon()).toBe(FAVICON_DEFAULT);
  });
});
