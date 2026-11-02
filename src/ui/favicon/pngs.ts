/**
 * Android / iOS: no browser tab, no tab-icon card (E03-S10 FV-5), so no PNGs.
 * They live in `pngs.web.ts`, which Metro picks on the web. Also what tsc and
 * jest resolve a bare `./pngs` to.
 */

import type { ImageSourcePropType } from 'react-native';

/** What `require()` of a PNG gives: `{ uri }` on the web, a number on native. */
export type PngAsset = ImageSourcePropType;

export interface FaviconPngs {
  readonly tab: PngAsset;
  readonly home: PngAsset;
  readonly grid: PngAsset;
}

export const FAVICON_PNGS: Readonly<Record<string, FaviconPngs>> = {};
