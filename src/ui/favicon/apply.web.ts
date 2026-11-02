/**
 * The web side of E03-S10: puts the chosen icon on the browser tab and as the
 * home-screen / bookmark icon, drawn on the device from the SVG in the bundle
 * (FV-2 — nothing is fetched, so it works offline).
 *
 * - `<link rel="icon">`: every one the page has gets the PNG (64 px, sharp on
 *   a 2× tab); its shipped href is kept in `data-mf-href` so เดิม can put it
 *   back exactly (FV-4). If the page has none, one is added and marked.
 * - `<link rel="apple-touch-icon">`: added and marked (PNG 180 on a tile);
 *   removed on เดิม. Used by iOS "Add to Home Screen" and by Android Chrome
 *   when there is no web app manifest (this app has none).
 * - If the browser cannot draw a PNG, the tab icon falls back to the SVG
 *   itself (Chrome / Firefox / Edge show it; no home-screen icon then).
 *
 * Choices can overlap while a PNG is drawing: only the latest one lands.
 */

import { FAVICON_DEFAULT, faviconSvg } from './choices';

export type Rasterize = (svg: string, size: number) => Promise<string>;

const MARK = 'data-mf-favicon';
const SHIPPED_HREF = 'data-mf-href';
const SHIPPED_TYPE = 'data-mf-type';

/** SVG text → PNG data URL through an <img> and a <canvas>. */
export const canvasRasterize: Rasterize = (svg, size) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('svg did not load'));
    img.src = svgDataUrl(svg);
  });

const svgDataUrl = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

let latest = 0;

function iconLinks(): HTMLLinkElement[] {
  // rel="icon" and rel="shortcut icon", never apple-touch-icon.
  return Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
}

function restore(): void {
  for (const link of iconLinks()) {
    if (link.hasAttribute(MARK)) {
      link.remove();
      continue;
    }
    if (!link.hasAttribute(SHIPPED_HREF)) continue;
    const href = link.getAttribute(SHIPPED_HREF)!;
    // An empty saved href means the shipped link had none.
    if (href === '') link.removeAttribute('href');
    else link.setAttribute('href', href);
    const type = link.getAttribute(SHIPPED_TYPE);
    if (type === null) link.removeAttribute('type');
    else link.setAttribute('type', type);
    link.removeAttribute(SHIPPED_HREF);
    link.removeAttribute(SHIPPED_TYPE);
  }
  document.head.querySelectorAll(`link[rel="apple-touch-icon"][${MARK}]`).forEach((l) => l.remove());
}

function setIcon(href: string, type: string): void {
  let links = iconLinks();
  if (links.length === 0) {
    const link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    link.setAttribute(MARK, '');
    document.head.appendChild(link);
    links = [link];
  }
  for (const link of links) {
    if (!link.hasAttribute(MARK) && !link.hasAttribute(SHIPPED_HREF)) {
      link.setAttribute(SHIPPED_HREF, link.getAttribute('href') ?? '');
      const shippedType = link.getAttribute('type');
      if (shippedType !== null) link.setAttribute(SHIPPED_TYPE, shippedType);
    }
    link.setAttribute('href', href);
    link.setAttribute('type', type);
  }
}

function setTouchIcon(href: string | null): void {
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="apple-touch-icon"][${MARK}]`);
  if (href === null) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'apple-touch-icon');
    link.setAttribute(MARK, '');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export async function applyFavicon(id: string, rasterize: Rasterize = canvasRasterize): Promise<void> {
  const turn = ++latest;
  const small = id === FAVICON_DEFAULT ? null : faviconSvg(id, 64);
  const big = id === FAVICON_DEFAULT ? null : faviconSvg(id, 180, { shape: 'home' });
  if (small === null || big === null) {
    restore();
    return;
  }
  let pngs: [string, string] | null;
  try {
    pngs = await Promise.all([rasterize(small, 64), rasterize(big, 180)]);
  } catch {
    pngs = null;
  }
  if (turn !== latest) return;
  if (pngs) {
    setIcon(pngs[0], 'image/png');
    setTouchIcon(pngs[1]);
  } else {
    setIcon(svgDataUrl(small), 'image/svg+xml');
    setTouchIcon(null);
  }
}
