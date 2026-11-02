/**
 * The tab icons a person can pick on "เครื่องนี้" (E03-S10): เดิม (the icon
 * the build ships, `assets/images/favicon.png`) and 20 FarmMate icons chosen
 * for reading at 16 and 32 px — bold silhouettes, no thin lines (thin ones
 * such as `sale.yieldStats` or `farm.treeCondition` were left out after
 * looking at all 40 at 16 px).
 *
 * Each is drawn in the light palette (the icon sits on the browser's tab
 * strip, not in the app, so it does not follow the app's theme), cropped to
 * its own drawing so it is as big as it can be at 16 px, and placed on a light
 * tile so a navy icon still shows on a dark tab strip.
 */

import { Rect, Svg } from 'react-native-svg';

import { tokens } from '../../../design/tokens';
import type { Theme } from '../../theme';
import { FARMMATE_ICON_VIEWBOX, getFarmMateIcon } from '../farmmate-icons/registry';
import { toSvgMarkup } from './svg-markup';

export const FAVICON_DEFAULT = 'default';

/**
 * id → the drawing's bounds on the 48 grid [x0, y0, x1, y1], measured with
 * the browser's getBBox() on 2026-11-02. If an icon is redrawn, re-measure;
 * the test only checks the crop stays square and inside the tile.
 */
const BOUNDS: Record<string, readonly [number, number, number, number]> = {
  'nav.home': [8, 10, 40, 40],
  'nav.myFarm': [12.4, 12.7, 35.6, 41.3],
  'nav.settings': [5, 5, 43, 43],
  'nav.notifications': [8, 8, 40, 44],
  'farm.allFarms': [7.8, 12.3, 42.2, 38.8],
  'farm.plotZone': [10, 8, 38, 42],
  'farm.map': [8, 8, 40, 40],
  'farm.weighPoint': [10.6, 8.5, 40, 46],
  'farm.photos': [8, 12, 40, 36],
  'sale.recordYield': [12, 15, 36, 40],
  'sale.weigh': [8, 8, 40, 40],
  'sale.sale': [8, 12, 39, 39],
  'sale.rubberPrice': [8, 10, 40, 40],
  'sale.comparePrice': [12, 8, 42.9, 38.9],
  'sale.salesReport': [8, 8, 40.1, 40.4],
  'finance.income': [9, 3.7, 39, 45],
  'finance.summary': [10.5, 5.5, 37.5, 42.5],
  'people.tapper': [8, 7.5, 40, 46],
  'people.transporter': [3, 10, 45, 40.5],
  'people.commsLog': [5.5, 5, 43.5, 42.7],
};

export const FAVICON_CHOICES: readonly string[] = Object.keys(BOUNDS);

// Registry icons read only `t.color`; the rest of a Theme is never touched.
const LIGHT = { color: tokens.color.light } as unknown as Theme;
const VB = FARMMATE_ICON_VIEWBOX;
/** Room left between the tile edge and the icon, on the 48 grid. */
const TAB_INSET = 3;
const HOME_INSET = 7;
/** Stroke half-widths stick out of getBBox(); keep a little air round the drawing. */
const AIR = 1;

/** A square viewBox around the drawing, centred on it. */
function cropBox(id: string): string {
  const [x0, y0, x1, y1] = BOUNDS[id];
  const side = Math.max(x1 - x0, y1 - y0) + AIR * 2;
  const r = (n: number) => Math.round(n * 100) / 100;
  return `${r((x0 + x1 - side) / 2)} ${r((y0 + y1 - side) / 2)} ${r(side)} ${r(side)}`;
}

/**
 * The icon as SVG text, `size` px square, or null for เดิม / an unknown id.
 * `tab` (default): a light rounded tile. `home`: a full square tile with more
 * margin — iOS rounds the corners itself and fills transparency black.
 */
export function faviconSvg(id: string, size: number, { shape = 'tab' }: { shape?: 'tab' | 'home' } = {}): string | null {
  const def = Object.hasOwn(BOUNDS, id) ? getFarmMateIcon(id) : undefined;
  if (!def) return null;
  const inset = shape === 'home' ? HOME_INSET : TAB_INSET;
  const inner = VB - inset * 2;
  return toSvgMarkup(
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
      <Rect x={0} y={0} width={VB} height={VB} rx={shape === 'home' ? undefined : 10} fill={tokens.color.light.surfaceRaised} />
      <Svg x={inset} y={inset} width={inner} height={inner} viewBox={cropBox(id)}>
        {def.Render(LIGHT)}
      </Svg>
    </Svg>,
  );
}
