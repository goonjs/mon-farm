/**
 * @jest-environment jsdom
 *
 * E03-S10 FV-2 / FV-4: the browser's <head> links. A chosen icon becomes
 * `<link rel="icon">` (PNG 64) and `<link rel="apple-touch-icon">` (PNG 180 on
 * a tile); เดิม puts back exactly what the build shipped. jsdom has no canvas,
 * so the SVG → PNG step is injected.
 */
import { applyFavicon, type Rasterize } from './apply.web';

const fake: Rasterize = async (svg, size) => {
  expect(svg).toContain(`width="${size}"`);
  return `data:image/png;base64,FAKE${size}`;
};

const SHIPPED = '<title>mon-farm</title><link rel="icon" href="/favicon.ico">';
const icon = () => document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
const touch = () => document.head.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');

beforeEach(() => {
  document.head.innerHTML = SHIPPED;
});

it('leaves <head> alone when the choice is เดิม and nothing was changed (FV-4)', async () => {
  await applyFavicon('default', fake);
  expect(document.head.innerHTML).toBe(SHIPPED);
});

it('sets the tab icon and the home-screen icon from the chosen icon (FV-2)', async () => {
  await applyFavicon('sale.weigh', fake);
  expect(icon()!.getAttribute('href')).toBe('data:image/png;base64,FAKE64');
  expect(icon()!.getAttribute('type')).toBe('image/png');
  expect(document.head.querySelectorAll('link[rel="icon"]')).toHaveLength(1);
  expect(touch()!.getAttribute('href')).toBe('data:image/png;base64,FAKE180');
});

it('puts back the shipped favicon and removes the home-screen icon on เดิม (FV-4)', async () => {
  await applyFavicon('sale.weigh', fake);
  await applyFavicon('nav.home', fake);
  await applyFavicon('default', fake);
  expect(document.head.innerHTML).toBe(SHIPPED);
});

it('the last choice wins even when an earlier one finishes drawing later', async () => {
  const waiting: (() => void)[] = [];
  const slow: Rasterize = (svg, size) =>
    new Promise((ok) => {
      waiting.push(() => ok(`data:image/png;base64,SLOW${size}`));
    });
  const release = () => waiting.forEach((go) => go());
  const first = applyFavicon('sale.weigh', slow);
  await applyFavicon('nav.home', fake);
  release();
  await first;
  expect(icon()!.getAttribute('href')).toBe('data:image/png;base64,FAKE64');
});

it('falls back to the SVG itself when the browser cannot draw a PNG', async () => {
  await applyFavicon('sale.weigh', async () => {
    throw new Error('no canvas');
  });
  expect(icon()!.getAttribute('href')).toMatch(/^data:image\/svg\+xml,%3Csvg/);
  expect(icon()!.getAttribute('type')).toBe('image/svg+xml');
  expect(touch()).toBeNull();
});

it('adds its own icon link when the page has none, and removes it again on เดิม', async () => {
  document.head.innerHTML = '<title>mon-farm</title>';
  await applyFavicon('nav.home', fake);
  expect(icon()!.getAttribute('href')).toBe('data:image/png;base64,FAKE64');
  await applyFavicon('default', fake);
  expect(document.head.innerHTML).toBe('<title>mon-farm</title>');
});

it('ignores an id it does not know, like เดิม', async () => {
  await applyFavicon('sale.weigh', fake);
  await applyFavicon('nope.nope', fake);
  expect(document.head.innerHTML).toBe(SHIPPED);
});

it('puts back a shipped icon link that had no href without inventing an empty one', async () => {
  document.head.innerHTML = '<link rel="icon" type="image/x-icon">';
  await applyFavicon('nav.home', fake);
  await applyFavicon('default', fake);
  expect(document.head.innerHTML).toBe('<link rel="icon" type="image/x-icon">');
});
