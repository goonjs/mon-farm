/**
 * @jest-environment jsdom
 *
 * E03-S10 FV-2: the browser's <head> links. The chosen icon becomes
 * `<link rel="icon">` (its 64 px PNG) and `<link rel="apple-touch-icon">` (its
 * 180 px PNG). Owner 2026-11-02: there is no Expo icon any more — the build
 * ships กรีดยาง as /favicon.ico, and an unknown id means กรีดยาง. Under jest a
 * required PNG is `{ testUri }`; on the web build it is `{ uri }`.
 */
import { applyFavicon } from './apply.web';

const urlOf = (asset: unknown) => (asset as { testUri: string }).testUri;
const png = (id: string, size: number) => `../../../assets/favicons/${id}-${size}.png`;

const SHIPPED = '<title>mon-farm</title><link rel="icon" href="/favicon.ico">';
const icons = () => [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')];
const touches = () => [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]')];

beforeEach(() => {
  document.head.innerHTML = SHIPPED;
});

it('points the tab icon and the home-screen icon at the chosen PNGs (FV-2)', () => {
  applyFavicon('sale.weigh', urlOf);
  expect(icons().map((l) => [l.getAttribute('href'), l.getAttribute('type')])).toEqual([[png('sale.weigh', 64), 'image/png']]);
  expect(touches().map((l) => l.getAttribute('href'))).toEqual([png('sale.weigh', 180)]);
});

it('a second choice replaces the first, without adding links', () => {
  applyFavicon('sale.weigh', urlOf);
  applyFavicon('nav.home', urlOf);
  expect(icons().map((l) => l.getAttribute('href'))).toEqual([png('nav.home', 64)]);
  expect(touches().map((l) => l.getAttribute('href'))).toEqual([png('nav.home', 180)]);
  expect(document.head.querySelectorAll('link')).toHaveLength(2);
});

it('an unknown id (e.g. the old "default") means the default, กรีดยาง', () => {
  applyFavicon('default', urlOf);
  expect(icons().map((l) => l.getAttribute('href'))).toEqual([png('farmwork.tapping', 64)]);
  expect(touches().map((l) => l.getAttribute('href'))).toEqual([png('farmwork.tapping', 180)]);
});

it('adds an icon link when the page has none', () => {
  document.head.innerHTML = '<title>mon-farm</title>';
  applyFavicon('sale.weigh', urlOf);
  expect(icons().map((l) => l.getAttribute('href'))).toEqual([png('sale.weigh', 64)]);
});

// Review round 2 #5: on the web build `require(png)` is `{ uri, width, height }`
// (seen in the exported bundle); the default URL reader takes `uri`.
it('reads { uri } assets by default', () => {
  jest.isolateModules(() => {
    jest.doMock('./pngs.web', () => ({
      FAVICON_PNGS: { 'farmwork.tapping': { tab: { uri: '/a/t-64.png' }, home: { uri: '/a/t-180.png' }, grid: { uri: '/a/t-128.png' } } },
    }));
    const { applyFavicon: apply } = jest.requireActual<typeof import('./apply.web')>('./apply.web');
    apply('farmwork.tapping');
  });
  expect(icons().map((l) => l.getAttribute('href'))).toEqual(['/a/t-64.png']);
  expect(touches().map((l) => l.getAttribute('href'))).toEqual(['/a/t-180.png']);
});
