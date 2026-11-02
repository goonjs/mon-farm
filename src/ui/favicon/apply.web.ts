/**
 * The web side of E03-S10: points the browser tab and the home-screen /
 * bookmark icon at the chosen icon's PNGs, which ship with the build in
 * assets/favicons (FV-2 — same origin as the app, nothing drawn at run time).
 *
 * - `<link rel="icon">`: every one the page has gets the 64 px PNG (the build
 *   ships /favicon.ico made from the default, กรีดยาง — app.json). If the page
 *   has none, one is added.
 * - `<link rel="apple-touch-icon">`: added (180 px PNG). Used by iOS "Add to
 *   Home Screen" and by Android Chrome when there is no web app manifest (this
 *   app has none). The static HTML has none, so start-up always sets it.
 */

import { FAVICON_DEFAULT } from './choices';
import type { PngAsset } from './pngs';
import { FAVICON_PNGS } from './pngs.web';

/** A required PNG → its URL. On the web build `require()` gives `{ uri }`. */
export type UrlOf = (asset: PngAsset) => string;
const webUrl: UrlOf = (asset) => (asset as { uri: string }).uri;

const MARK = 'data-mf-favicon';

function setIcon(href: string): void {
  // rel="icon" and rel="shortcut icon", never apple-touch-icon.
  let links = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
  if (links.length === 0) {
    const link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    link.setAttribute(MARK, '');
    document.head.appendChild(link);
    links = [link];
  }
  for (const link of links) {
    link.setAttribute('href', href);
    link.setAttribute('type', 'image/png');
  }
}

function setTouchIcon(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'apple-touch-icon');
    link.setAttribute(MARK, '');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/** An id that is not a choice (e.g. the old "default") means the default. */
export function applyFavicon(id: string, urlOf: UrlOf = webUrl): void {
  const icon = FAVICON_PNGS[Object.hasOwn(FAVICON_PNGS, id) ? id : FAVICON_DEFAULT];
  setIcon(urlOf(icon.tab));
  setTouchIcon(urlOf(icon.home));
}
