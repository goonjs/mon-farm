/**
 * E03-S10 favicon picker: the icon element → SVG text (FV-2: drawn from the
 * bundle, nothing fetched), the 20 choices (FV-1) and the device setting
 * (FV-3: `mon-farm:favicon`, unknown → เดิม).
 */
import { Fragment } from 'react';
import { Circle, Ellipse, G, Path, Rect, Svg } from 'react-native-svg';

import { getFarmMateIcon } from '../farmmate-icons/registry';
import { FAVICON_BOUNDS, FAVICON_CHOICES, FAVICON_DEFAULT, faviconSvg } from './choices';
import { readFavicon, writeFavicon } from './preference';
import { toSvgMarkup } from './svg-markup';

const stored = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => void stored.set(k, v),
  },
});
beforeEach(() => stored.clear());

describe('toSvgMarkup', () => {
  it('writes react-native-svg primitives as SVG tags with kebab-case attributes', () => {
    const out = toSvgMarkup(
      <Svg width={64} height={64} viewBox="0 0 48 48">
        <G>
          <Rect x={1} y={2} width={3} height={4} rx={1} fill="fill-a" transform="rotate(45 2 3)" />
          <Path d="M0 0 L1 1" stroke="ink-b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </G>
        <Circle cx={5} cy={6} r={7} fill="fill-c" />
        <Ellipse cx={1} cy={2} rx={3} ry={4} fill="fill-d" />
      </Svg>,
    );
    expect(out).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 48 48">' +
        '<g><rect x="1" y="2" width="3" height="4" rx="1" fill="fill-a" transform="rotate(45 2 3)"/>' +
        '<path d="M0 0 L1 1" stroke="ink-b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>' +
        '<circle cx="5" cy="6" r="7" fill="fill-c"/><ellipse cx="1" cy="2" rx="3" ry="4" fill="fill-d"/></svg>',
    );
  });

  it('expands function components, fragments and arrays; drops keys, null and false', () => {
    function Dot({ at }: { at: number }) {
      return <Circle cx={at} cy={at} r={1} fill="ink-b" />;
    }
    const out = toSvgMarkup(
      <Svg viewBox="0 0 2 2">
        <>
          {[1, 2].map((n) => (
            <Dot key={n} at={n} />
          ))}
          {null}
          {false}
          <Fragment>
            <Rect key="r" x={0} y={0} width={1} height={1} fill="fill-e" />
          </Fragment>
        </>
      </Svg>,
    );
    expect(out).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2">' +
        '<circle cx="1" cy="1" r="1" fill="ink-b"/><circle cx="2" cy="2" r="1" fill="ink-b"/>' +
        '<rect x="0" y="0" width="1" height="1" fill="fill-e"/></svg>',
    );
  });

  it('escapes attribute values', () => {
    expect(toSvgMarkup(<Svg viewBox={'0 0 1 1" onload="x'} />)).toContain('viewBox="0 0 1 1&quot; onload=&quot;x"');
  });

  it('refuses an element it does not know, rather than writing something wrong', () => {
    const Unknown = 'foreignObject' as unknown as typeof G;
    expect(() => toSvgMarkup(<Svg><Unknown /></Svg>)).toThrow(/foreignObject/);
  });
});

describe('favicon choices (FV-1)', () => {
  it('offers 20 different FarmMate icons that exist in the registry', () => {
    expect(FAVICON_CHOICES).toHaveLength(20);
    expect(new Set(FAVICON_CHOICES).size).toBe(20);
    for (const id of FAVICON_CHOICES) expect(getFarmMateIcon(id)).toBeDefined();
  });

  it.each(FAVICON_CHOICES)('%s draws as a complete SVG with only literal colours', (id) => {
    const svg = faviconSvg(id, 64)!;
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 48 48">')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).not.toMatch(/undefined|NaN|\[object|function/);
    for (const [, colour] of svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)) expect(colour).toMatch(/^(#[0-9a-fA-F]{3,8}|none|rgba?\([\d., ]+\))$/);
  });

  it('draws the tab icon on a light rounded tile, so a navy icon still shows on a dark tab strip', () => {
    const svg = faviconSvg('nav.home', 64)!;
    expect(svg).toMatch(/^<svg[^>]*><rect x="0" y="0" width="48" height="48" rx="(\d+(\.\d+)?)" fill="#[0-9a-fA-F]{6}"\/>/);
  });

  it('draws the home-screen icon on a square solid tile (iOS rounds it itself; it fills transparency black)', () => {
    const svg = faviconSvg('nav.home', 180, { shape: 'home' })!;
    expect(svg).toMatch(/^<svg[^>]*><rect x="0" y="0" width="48" height="48" fill="#[0-9a-fA-F]{6}"\/>/);
  });

  it.each(FAVICON_CHOICES)('%s is cropped to its own drawing, inside the tile', (id) => {
    const inner = /<svg xmlns="http:\/\/www.w3.org\/2000\/svg" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" viewBox="([-\d. ]+)">/.exec(
      faviconSvg(id, 64)!,
    );
    expect(inner).not.toBeNull();
    const [x, y, w, h] = inner!.slice(1, 5).map(Number);
    expect(x).toBeGreaterThan(0);
    expect(x + w).toBeLessThan(48);
    expect(y + h).toBeLessThan(48);
    expect(w).toBe(h);
    const [, , vw, vh] = inner![5].split(' ').map(Number);
    expect(vw).toBe(vh);
    expect(vw).toBeLessThan(48); // tighter than the 48 grid: bigger at 16 px
  });

  // Review E03-S10 #1: getBBox() leaves out stroke width, so a crop that hugs
  // the measured bounds cut the calculator's frame and the basket handle.
  it.each(FAVICON_CHOICES)('%s: the crop leaves room for the widest stroke in the icon', (id) => {
    const svg = faviconSvg(id, 64)!;
    const half = Math.max(0, ...[...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]) / 2));
    const [vx, vy, vs] = /viewBox="([-\d. ]+)">(?!<rect)/.exec(svg.slice(svg.indexOf('<svg', 1)))![1].split(' ').map(Number);
    const [x0, y0, x1, y1] = FAVICON_BOUNDS[id];
    expect(vx).toBeLessThanOrEqual(x0 - half);
    expect(vy).toBeLessThanOrEqual(y0 - half);
    expect(vx + vs).toBeGreaterThanOrEqual(x1 + half);
    expect(vy + vs).toBeGreaterThanOrEqual(y1 + half);
  });

  it('has nothing to draw for เดิม or an unknown id', () => {
    expect(faviconSvg(FAVICON_DEFAULT, 64)).toBeNull();
    expect(faviconSvg('nope.nope', 64)).toBeNull();
  });
});

describe('favicon device setting (FV-3)', () => {
  it('defaults to เดิม', () => {
    expect(readFavicon()).toBe(FAVICON_DEFAULT);
  });

  it('remembers a choice under mon-farm:favicon', () => {
    writeFavicon('sale.weigh');
    expect(stored.get('mon-farm:favicon')).toBe('sale.weigh');
    expect(readFavicon()).toBe('sale.weigh');
  });

  it('reads an unknown or removed icon id as เดิม', () => {
    stored.set('mon-farm:favicon', 'farm.gone');
    expect(readFavicon()).toBe(FAVICON_DEFAULT);
  });
});
