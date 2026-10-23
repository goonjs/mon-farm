/**
 * FarmMate icon set — flat, filled, multi-colour icons (E01-S13 Dev notes:
 * owner picked "FarmMate" over Feather/@expo/vector-icons). Hand-authored as
 * react-native-svg vectors from `references/farmmate-icon-pack.png` (a
 * composite mockup sheet, not per-icon masters — see the sheet's own small
 * per-icon resolution). Pilot batch: the sheet's first three categories
 * (top row, left/middle/right) — 24 of ~70 icons.
 *
 * Colour: no raw hex in `src/` (scripts/no-raw-colour.test.ts) — every fill
 * reads a semantic role from `theme.color`. The mockup's own 7-swatch legend
 * (Navy/Green/Bright Green/Yellow/Blue/Red/Gray) does not map 1:1 onto this
 * app's roles, because several of those roles are reserved *signals*
 * (`accept`=green/done, `reject`=red/voided, `warn`=amber/pending — see
 * design/tokens.ts "Signal roles stay DISJOINT"). These icons are
 * decorative/navigational, not state, so signal roles are never used here.
 * Substitutions made instead:
 *
 *   mockup swatch        → role used here   → why
 *   Navy (primary ink)   → ink / action     → navy already means these two things
 *   Green (secondary)    → brandStrong      → `brand*` is the decorative-fill family
 *   Bright green (lite)  → brandLight       → ditto; NOT `accept` (that's a state)
 *   Yellow (accent)      → brandYellow      → existing decorative yellow role
 *   Blue (info)          → category2        → no generic "info" role exists;
 *                                              `debtIn` is blue but means one
 *                                              specific settlement direction
 *   Red (error)          → category5        → NOT `reject` (that's a state);
 *                                              orange `category5` reads closest
 *   Gray (neutral)        → inkSoft / inkFaint
 *
 * See the Artifact proposal (linked from the PR) for where each icon is
 * recommended to replace or sit beside existing UI.
 */

import type { ReactElement } from 'react';
import { Circle, G, Path, Rect, Svg } from 'react-native-svg';

import type { Theme } from '../../theme';

export type FarmMateIconCategory = 'nav' | 'farm' | 'sale';

export interface FarmMateIconDef {
  id: string;
  /** Thai label exactly as on the reference sheet, for the catalog page. */
  labelTh: string;
  category: FarmMateIconCategory;
  /** What it replaces/pairs with today, for quick scanning on the catalog page. */
  note: string;
  Render: (theme: Theme) => ReactElement;
}

const VB = 48; // every icon is authored on a 48x48 grid, viewBox scales to `size`

// ── Shared shapes (keeps 24 icons DRY — same approach as `Coin` in icons.tsx) ─

function Tree({ cx, cy, s, canopy, trunk }: { cx: number; cy: number; s: number; canopy: string; trunk: string }) {
  return (
    <G>
      <Rect x={cx - s * 0.06} y={cy + s * 0.1} width={s * 0.12} height={s * 0.35} fill={trunk} rx={s * 0.03} />
      <Circle cx={cx} cy={cy - s * 0.05} r={s * 0.34} fill={canopy} />
    </G>
  );
}

function PersonBust({ cx, cy, s, fill }: { cx: number; cy: number; s: number; fill: string }) {
  return (
    <G>
      <Circle cx={cx} cy={cy - s * 0.22} r={s * 0.17} fill={fill} />
      <Path
        d={`M${cx - s * 0.3} ${cy + s * 0.3} a${s * 0.3} ${s * 0.3} 0 0 1 ${s * 0.6} 0 Z`}
        fill={fill}
      />
    </G>
  );
}

function DocLines({ x, y, w, lineColor, count = 3 }: { x: number; y: number; w: number; lineColor: string; count?: number }) {
  return (
    <G>
      {Array.from({ length: count }).map((_, i) => (
        <Rect
          key={i}
          x={x}
          y={y + i * (VB * 0.09)}
          width={i === count - 1 ? w * 0.6 : w}
          height={VB * 0.045}
          rx={VB * 0.02}
          fill={lineColor}
        />
      ))}
    </G>
  );
}

function CoinGlyph({ cx, cy, r, ring, mark }: { cx: number; cy: number; r: number; ring: string; mark: string }) {
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill={ring} />
      <Path
        d={`M${cx} ${cy - r * 0.45} v${r * 0.9} M${cx - r * 0.3} ${cy - r * 0.25} q0 -${r * 0.25} ${r * 0.3} -${r * 0.25} t${r * 0.3} ${r * 0.25} q0 ${r * 0.25} -${r * 0.3} ${r * 0.25} h-${r * 0.3}`}
        stroke={mark}
        strokeWidth={r * 0.14}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
}

// ── หมวดหลัก / นำทาง — nav ────────────────────────────────────────────────────

const navHome: FarmMateIconDef = {
  id: 'nav.home',
  labelTh: 'หน้าแรก',
  category: 'nav',
  note: 'replaces existing line HomeIcon on the primary tab',
  Render: (t) => (
    <>
      <Path d={`M8 24 L24 10 L40 24 V40 H8 Z`} fill={t.color.action} />
      <Rect x={20} y={28} width={8} height={12} fill={t.color.inkInverse} rx={1} />
    </>
  ),
};

const navMyFarm: FarmMateIconDef = {
  id: 'nav.myFarm',
  labelTh: 'สวนของฉัน',
  category: 'nav',
  note: 'replaces existing line FarmIcon',
  Render: (t) => <Tree cx={24} cy={26} s={34} canopy={t.color.brandStrong} trunk={t.color.action} />,
};

const navReports: FarmMateIconDef = {
  id: 'nav.reports',
  labelTh: 'รายงาน',
  category: 'nav',
  note: 'replaces existing line ChartIcon on the nav/menu row',
  Render: (t) => (
    <G>
      <Rect x={10} y={26} width={7} height={14} rx={1.5} fill={t.color.category2} />
      <Rect x={20} y={18} width={7} height={22} rx={1.5} fill={t.color.action} />
      <Rect x={30} y={10} width={7} height={30} rx={1.5} fill={t.color.brandStrong} />
    </G>
  ),
};

const navSettings: FarmMateIconDef = {
  id: 'nav.settings',
  labelTh: 'ตั้งค่า',
  category: 'nav',
  note: 'replaces existing line GearIcon',
  Render: (t) => (
    <G>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <Rect
          key={deg}
          x={21}
          y={5}
          width={6}
          height={11}
          rx={2}
          fill={t.color.action}
          transform={`rotate(${deg} 24 24)`}
        />
      ))}
      <Circle cx={24} cy={24} r={9} fill={t.color.surfaceRaised} stroke={t.color.action} strokeWidth={4} />
    </G>
  ),
};

const navNotifications: FarmMateIconDef = {
  id: 'nav.notifications',
  labelTh: 'แจ้งเตือน',
  category: 'nav',
  note: 'new — no current equivalent icon; app bar bell slot',
  Render: (t) => (
    <G>
      <Path d="M24 8 a12 12 0 0 1 12 12 v6 l4 6 H8 l4 -6 v-6 a12 12 0 0 1 12 -12 Z" fill={t.color.brandYellow} />
      <Circle cx={24} cy={40} r={4} fill={t.color.action} />
    </G>
  ),
};

const navProfile: FarmMateIconDef = {
  id: 'nav.profile',
  labelTh: 'โปรไฟล์',
  category: 'nav',
  note: 'replaces existing line PersonIcon on the drawer header',
  Render: (t) => <PersonBust cx={24} cy={24} s={32} fill={t.color.action} />,
};

const navHelp: FarmMateIconDef = {
  id: 'nav.help',
  labelTh: 'ช่วยเหลือ',
  category: 'nav',
  note: 'new — drawer footer link',
  Render: (t) => (
    <G>
      <Circle cx={24} cy={24} r={16} fill={t.color.category2} />
      <Path
        d="M20 19 a4.5 4.5 0 1 1 7 3.6 q-3 2 -3 5.4"
        stroke={t.color.inkInverse}
        strokeWidth={3.4}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={24} cy={34} r={2.2} fill={t.color.inkInverse} />
    </G>
  ),
};

const navMore: FarmMateIconDef = {
  id: 'nav.more',
  labelTh: 'เพิ่มเติม',
  category: 'nav',
  note: 'new — overflow menu trigger',
  Render: (t) => (
    <G>
      <Circle cx={13} cy={24} r={4} fill={t.color.inkSoft} />
      <Circle cx={24} cy={24} r={4} fill={t.color.inkSoft} />
      <Circle cx={35} cy={24} r={4} fill={t.color.inkSoft} />
    </G>
  ),
};

// ── หมวดสวนและแปลง — farm ─────────────────────────────────────────────────────

const farmAllFarms: FarmMateIconDef = {
  id: 'farm.allFarms',
  labelTh: 'สวนทั้งหมด',
  category: 'farm',
  note: 'farms list screen header',
  Render: (t) => (
    <G>
      <Tree cx={16} cy={28} s={24} canopy={t.color.brandLight} trunk={t.color.action} />
      <Tree cx={32} cy={24} s={30} canopy={t.color.brandStrong} trunk={t.color.action} />
    </G>
  ),
};

const farmPlotZone: FarmMateIconDef = {
  id: 'farm.plotZone',
  labelTh: 'แปลง/โซน',
  category: 'farm',
  note: 'replaces existing line PinIcon on zone rows',
  Render: (t) => (
    <G>
      <Path d="M24 8 C32 8 38 14 38 22 C38 32 24 42 24 42 C24 42 10 32 10 22 C10 14 16 8 24 8 Z" fill={t.color.action} />
      <Circle cx={24} cy={21} r={6} fill={t.color.brandStrong} />
    </G>
  ),
};

const farmMap: FarmMateIconDef = {
  id: 'farm.map',
  labelTh: 'แผนที่สวน',
  category: 'farm',
  note: 'new — farm map/overview tab',
  Render: (t) => (
    <G>
      <Path d="M8 12 L18 8 L30 12 L40 8 V36 L30 40 L18 36 L8 40 Z" fill={t.color.brandLight} />
      <Path d="M18 8 V36 M30 12 V40" stroke={t.color.action} strokeWidth={2} />
    </G>
  ),
};

const farmWeighPoint: FarmMateIconDef = {
  id: 'farm.weighPoint',
  labelTh: 'จุดชั่งน้ำหนัก',
  category: 'farm',
  note: 'weighing-point picker on the farm map',
  Render: (t) => (
    <G>
      <Tree cx={16} cy={16} s={16} canopy={t.color.brandLight} trunk={t.color.action} />
      <Tree cx={28} cy={14} s={14} canopy={t.color.brandStrong} trunk={t.color.action} />
      <Path d="M30 24 C36 24 40 28 40 33 C40 39 30 46 30 46 C30 46 20 39 20 33 C20 28 24 24 30 24 Z" fill={t.color.category5} />
      <Circle cx={30} cy={33} r={4} fill={t.color.inkInverse} />
    </G>
  ),
};

const farmInfo: FarmMateIconDef = {
  id: 'farm.info',
  labelTh: 'ข้อมูลสวน',
  category: 'farm',
  note: 'farm detail screen header',
  Render: (t) => (
    <G>
      <Rect x={10} y={8} width={28} height={32} rx={3} fill={t.color.surfaceSunk} stroke={t.color.action} strokeWidth={2.4} />
      <Circle cx={16} cy={16} r={2.2} fill={t.color.accept} />
      <DocLines x={21} y={14} w={14} lineColor={t.color.inkSoft} count={1} />
      <Circle cx={16} cy={24} r={2.2} fill={t.color.accept} />
      <DocLines x={21} y={22} w={14} lineColor={t.color.inkSoft} count={1} />
      <Circle cx={16} cy={32} r={2.2} fill={t.color.warn} />
      <DocLines x={21} y={30} w={14} lineColor={t.color.inkSoft} count={1} />
    </G>
  ),
};

const farmTreeCondition: FarmMateIconDef = {
  id: 'farm.treeCondition',
  labelTh: 'สภาพต้นยาง',
  category: 'farm',
  note: 'new — per-tree health note',
  Render: (t) => (
    <G>
      <Path d="M24 11 C33 15 33 27 24 37 C15 27 15 15 24 11 Z" fill={t.color.brandStrong} />
      <Path d="M24 15 V33" stroke={t.color.action} strokeWidth={1.6} strokeLinecap="round" />
    </G>
  ),
};

const farmActivity: FarmMateIconDef = {
  id: 'farm.activity',
  labelTh: 'กิจกรรมในสวน',
  category: 'farm',
  note: 'replaces existing line ListIcon on the farm activity log',
  Render: (t) => (
    <G>
      {[14, 22, 30].map((y) => (
        <G key={y}>
          <Rect x={10} y={y} width={6} height={6} rx={1.5} fill={t.color.accept} />
          <Path d={`M11.2 ${y + 3} l1.3 1.4 l2.2 -2.6`} stroke={t.color.inkInverse} strokeWidth={1.2} fill="none" />
          <Rect x={20} y={y + 1} width={18} height={3.6} rx={1.8} fill={t.color.inkSoft} />
        </G>
      ))}
    </G>
  ),
};

const farmPhotos: FarmMateIconDef = {
  id: 'farm.photos',
  labelTh: 'รูปภาพ',
  category: 'farm',
  note: 'yield/plot photo gallery',
  Render: (t) => (
    <G>
      <Rect x={8} y={12} width={32} height={24} rx={3} fill={t.color.surfaceSunk} stroke={t.color.action} strokeWidth={2.2} />
      <Circle cx={17} cy={21} r={3.4} fill={t.color.brandYellow} />
      <Path d="M10 34 L19 24 L25 30 L32 22 L38 34 Z" fill={t.color.brandLight} />
    </G>
  ),
};

// ── หมวดผลผลิตและการขาย — sale ─────────────────────────────────────────────────

const saleRecordYield: FarmMateIconDef = {
  id: 'sale.recordYield',
  labelTh: 'บันทึกผลผลิต',
  category: 'sale',
  note: 'replaces existing line BasketIcon on the record-yield action',
  Render: (t) => (
    <G>
      <Path d="M12 20 H36 L32 40 H16 Z" fill={t.color.brandYellow} />
      <Path d="M12 20 Q24 10 36 20" stroke={t.color.action} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M18 26 V34 M24 26 V34 M30 26 V34" stroke={t.color.action} strokeWidth={2} strokeLinecap="round" />
    </G>
  ),
};

const saleWeigh: FarmMateIconDef = {
  id: 'sale.weigh',
  labelTh: 'ชั่งน้ำหนัก',
  category: 'sale',
  note: 'replaces existing line ScaleIcon on the weigh-in flow entry',
  Render: (t) => (
    <G>
      <Circle cx={24} cy={24} r={16} fill={t.color.brandStrong} />
      <Path d="M24 15 V24 L30 28" stroke={t.color.inkInverse} strokeWidth={3} strokeLinecap="round" fill="none" />
    </G>
  ),
};

const saleSale: FarmMateIconDef = {
  id: 'sale.sale',
  labelTh: 'การขาย',
  category: 'sale',
  note: 'sale-flow tab/entry point',
  Render: (t) => (
    <G>
      <Path d="M8 12 H12 L17 30 H34 L39 16 H14" stroke={t.color.action} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={19} cy={36} r={3} fill={t.color.action} />
      <Circle cx={32} cy={36} r={3} fill={t.color.action} />
      <Circle cx={30} cy={22} r={7} fill={t.color.brandYellow} />
      <Path d="M30 18.5 v7 M27.8 20 h4.4" stroke={t.color.action} strokeWidth={1.6} strokeLinecap="round" />
    </G>
  ),
};

const saleYieldStats: FarmMateIconDef = {
  id: 'sale.yieldStats',
  labelTh: 'สถิติผลผลิต',
  category: 'sale',
  note: 'replaces existing line ChartIcon on the yield-stats screen',
  Render: (t) => (
    <G>
      <Path d="M8 34 L18 22 L26 28 L40 10" stroke={t.color.accept} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M32 10 H40 V18" stroke={t.color.accept} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  ),
};

const saleRubberPrice: FarmMateIconDef = {
  id: 'sale.rubberPrice',
  labelTh: 'ราคายาง',
  category: 'sale',
  note: 'rubber-price reference screen',
  Render: (t) => (
    <G>
      <CoinGlyph cx={18} cy={30} r={10} ring={t.color.brandYellow} mark={t.color.action} />
      <CoinGlyph cx={30} cy={20} r={10} ring={t.color.brandYellow} mark={t.color.action} />
    </G>
  ),
};

const saleComparePrice: FarmMateIconDef = {
  id: 'sale.comparePrice',
  labelTh: 'เปรียบเทียบราคา',
  category: 'sale',
  note: 'price-compare tool',
  Render: (t) => (
    <G>
      <Path
        d="M14 8 H30 a4 4 0 0 1 2.8 1.2 l9 9 a4 4 0 0 1 0 5.6 l-14 14 a4 4 0 0 1 -5.6 0 l-9 -9 A4 4 0 0 1 12 26 V12 a4 4 0 0 1 2 -4 Z"
        fill={t.color.category5}
      />
      <Circle cx={20} cy={16} r={3} fill={t.color.inkInverse} />
    </G>
  ),
};

const saleReceipt: FarmMateIconDef = {
  id: 'sale.receipt',
  labelTh: 'ใบเสร็จ',
  category: 'sale',
  note: 'replaces existing line ReceiptIcon on the sale confirmation',
  Render: (t) => (
    <G>
      <Path
        d="M12 8 H36 V42 L32 39 L28 42 L24 39 L20 42 L16 39 L12 42 Z"
        fill={t.color.surfaceSunk}
        stroke={t.color.action}
        strokeWidth={2}
      />
      <DocLines x={16} y={16} w={16} lineColor={t.color.inkSoft} count={2} />
      <Circle cx={18} cy={30} r={4} fill={t.color.brandYellow} />
      <Path d="M18 27.4 v5.2 M16.4 29.4 h3.2" stroke={t.color.action} strokeWidth={1.2} strokeLinecap="round" />
    </G>
  ),
};

const saleSalesReport: FarmMateIconDef = {
  id: 'sale.salesReport',
  labelTh: 'รายงานการขาย',
  category: 'sale',
  note: 'replaces existing line ChartIcon on the sales-report screen',
  Render: (t) => (
    <G>
      <Circle cx={24} cy={24} r={16} fill={t.color.surfaceSunk} />
      <Path d="M24 24 L24 8 A16 16 0 0 1 38 32 Z" fill={t.color.action} />
      <Path d="M24 24 L38 32 A16 16 0 0 1 14 37 Z" fill={t.color.brandStrong} />
    </G>
  ),
};

export const FARMMATE_ICONS: FarmMateIconDef[] = [
  navHome,
  navMyFarm,
  navReports,
  navSettings,
  navNotifications,
  navProfile,
  navHelp,
  navMore,
  farmAllFarms,
  farmPlotZone,
  farmMap,
  farmWeighPoint,
  farmInfo,
  farmTreeCondition,
  farmActivity,
  farmPhotos,
  saleRecordYield,
  saleWeigh,
  saleSale,
  saleYieldStats,
  saleRubberPrice,
  saleComparePrice,
  saleReceipt,
  saleSalesReport,
];

export const FARMMATE_ICON_CATEGORY_LABEL_TH: Record<FarmMateIconCategory, string> = {
  nav: 'หมวดหลัก / นำทาง',
  farm: 'หมวดสวนและแปลง',
  sale: 'หมวดผลผลิตและการขาย',
};

export function getFarmMateIcon(id: string): FarmMateIconDef | undefined {
  return FARMMATE_ICONS.find((icon) => icon.id === id);
}

export { Svg, VB as FARMMATE_ICON_VIEWBOX };
