/**
 * FarmMate icon set — flat, filled, multi-colour icons (E01-S13 Dev notes:
 * owner picked "FarmMate" over Feather/@expo/vector-icons). Hand-authored as
 * react-native-svg vectors from `references/farmmate-icon-pack.png` (a
 * composite mockup sheet, not per-icon masters — see the sheet's own small
 * per-icon resolution). Pilot batch: the sheet's first three categories
 * (top row, left/middle/right) — 24 of ~70 icons. E05-S11 (CO-16, UI-5)
 * added `finance` and `people` (16 more, 40 in all), simplified onto the
 * 48 grid from the traced masters in design/icons/farmmate/<id>.svg
 * (labels from its manifest.json).
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
 * Extra tones in the finance/people masters:
 *   Amber/orange (bag band, coin edge, hat brim, orange hand) → category5
 *   Red (expense arrow, profitCost "cost" slice)  → category4 — category5 is
 *       already the coin edge/orange in those icons; NOT `reject`
 *   Red (tapper cap)      → category5 (per the table above)
 *   Dark green (buyer centre body) → category1 — NOT `accept`
 *   Light blue (tapper bib) → category2Sunk
 *   Skin                  → brandYellow (no skin role; reads emoji-style)
 *   Black hair            → ink
 *   White glyphs (฿, dots, contact) → inkInverse; separation gaps → surfaceRaised
 *
 * See the Artifact proposal (linked from the PR) for where each icon is
 * recommended to replace or sit beside existing UI.
 */

import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Path, Rect, Svg } from 'react-native-svg';

import type { Theme } from '../../theme';

export type FarmMateIconCategory = 'nav' | 'farm' | 'sale' | 'finance' | 'people';

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

// ── Finance / people helpers ──────────────────────────────────────────────────

/** Thai baht sign: a B with a vertical bar through it, stroked. */
function BahtGlyph({ cx, cy, h, color }: { cx: number; cy: number; h: number; color: string }) {
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  const x0 = cx - h * 0.28;
  const r = h / 4;
  return (
    <Path
      d={`M${x0} ${top} V${bottom} M${x0} ${top} H${cx} a${r} ${r} 0 0 1 0 ${h / 2} H${x0} M${x0} ${cy} H${cx + h * 0.04} a${r} ${r} 0 0 1 0 ${h / 2} H${x0} M${cx - h * 0.08} ${top - h * 0.16} V${bottom + h * 0.16}`}
      stroke={color}
      strokeWidth={h * 0.17}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

/** One pie slice; angles in degrees clockwise from 12 o'clock, nudged out along its bisector by `gap`. */
function PieSlice({ cx, cy, r, from, to, gap, fill }: { cx: number; cy: number; r: number; from: number; to: number; gap: number; fill: string }) {
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const mid = rad((from + to) / 2);
  const ox = cx + gap * Math.cos(mid);
  const oy = cy + gap * Math.sin(mid);
  const p = (deg: number) => `${(ox + r * Math.cos(rad(deg))).toFixed(2)} ${(oy + r * Math.sin(rad(deg))).toFixed(2)}`;
  return <Path d={`M${ox.toFixed(2)} ${oy.toFixed(2)} L${p(from)} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${p(to)} Z`} fill={fill} />;
}

/** One coin disc seen from the side: face ellipse over an edge band. */
function CoinDisc({ cx, cy, rx, ry, edge, face, side }: { cx: number; cy: number; rx: number; ry: number; edge: number; face: string; side: string }) {
  return (
    <G>
      <Path d={`M${cx - rx} ${cy} V${cy + edge} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy + edge} V${cy} Z`} fill={side} />
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={face} />
    </G>
  );
}

// ── หมวดการเงิน — finance ────────────────────────────────────────────────────

const financeIncome: FarmMateIconDef = {
  id: 'finance.income',
  labelTh: 'รายรับ',
  category: 'finance',
  note: 'money bag ฿ — income / money-in rows; close-out pay summary',
  Render: (t) => (
    <G>
      <Circle cx={18.5} cy={8.5} r={3.4} fill={t.color.brandYellow} />
      <Circle cx={24} cy={7.5} r={3.8} fill={t.color.brandYellow} />
      <Circle cx={29.5} cy={8.5} r={3.4} fill={t.color.brandYellow} />
      <Path d="M16 9 H32 L29 17 H19 Z" fill={t.color.brandYellow} />
      <Circle cx={24} cy={30} r={15} fill={t.color.brandYellow} />
      <Rect x={17.5} y={13.5} width={13} height={3} rx={1.5} fill={t.color.category5} />
      <BahtGlyph cx={24} cy={31} h={13} color={t.color.inkInverse} />
    </G>
  ),
};

const financeExpense: FarmMateIconDef = {
  id: 'finance.expense',
  labelTh: 'รายจ่าย',
  category: 'finance',
  note: 'coin stack with up arrow — expense entry / money-out rows',
  Render: (t) => (
    <G>
      {[33, 28, 23, 18].map((cy) => (
        <CoinDisc key={cy} cx={14} cy={cy} rx={10} ry={4} edge={3.4} face={t.color.brandYellow} side={t.color.category5} />
      ))}
      {[37, 32.5].map((cy) => (
        <CoinDisc key={cy} cx={35} cy={cy} rx={9} ry={3.6} edge={3.2} face={t.color.brandYellow} side={t.color.category5} />
      ))}
      <Path d="M36 24 V7 M29.5 13 L36 6.5 L42.5 13" stroke={t.color.category4} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  ),
};

const financeProfitCost: FarmMateIconDef = {
  id: 'finance.profitCost',
  labelTh: 'กำไร/ต้นทุน',
  category: 'finance',
  note: 'pie of profit vs cost — profit/cost breakdown',
  Render: (t) => (
    <G>
      <PieSlice cx={24} cy={25} r={16} from={68} to={240} gap={1.2} fill={t.color.category2} />
      <PieSlice cx={24} cy={25} r={16} from={240} to={358} gap={1.2} fill={t.color.brandStrong} />
      <PieSlice cx={24} cy={25} r={16} from={4} to={62} gap={2.6} fill={t.color.category4} />
    </G>
  ),
};

const financeSummary: FarmMateIconDef = {
  id: 'finance.summary',
  labelTh: 'สรุปการเงิน',
  category: 'finance',
  note: 'calculator — money summary / totals',
  Render: (t) => (
    <G>
      <Rect x={10.5} y={5.5} width={27} height={37} rx={5} fill="none" stroke={t.color.action} strokeWidth={3.4} />
      <Rect x={15.5} y={11} width={17} height={7} rx={1.5} fill={t.color.category2} />
      {[23, 30].map((y) =>
        [15.5, 22, 28.5].map((x) => <Rect key={`${x}-${y}`} x={x} y={y} width={4} height={4} rx={1} fill={t.color.category2} />),
      )}
    </G>
  ),
};

const financeSplit50: FarmMateIconDef = {
  id: 'finance.split50',
  labelTh: 'เงินที่ต้องแบ่ง 50%',
  category: 'finance',
  note: 'wallet — the 50% share to split (settlement share rows)',
  Render: (t) => (
    <G>
      <Path d="M9 15 L32 8.6 a2 2 0 0 1 2.5 1.4 L36 15" stroke={t.color.action} strokeWidth={2.6} strokeLinejoin="round" fill="none" />
      <Rect x={6} y={15} width={33} height={26} rx={4} fill={t.color.action} />
      <Rect x={28} y={23} width={14} height={10} rx={2} fill={t.color.action} stroke={t.color.inkInverse} strokeWidth={1.4} />
      <Circle cx={32.5} cy={28} r={3} fill={t.color.inkInverse} stroke={t.color.action} strokeWidth={1.2} />
    </G>
  ),
};

const financeWorkerPay: FarmMateIconDef = {
  id: 'finance.workerPay',
  labelTh: 'ค่าตอบแทนคนงาน',
  category: 'finance',
  note: 'two workers — worker pay / what the farm owes a tapper',
  Render: (t) => (
    <G>
      <Circle cx={34} cy={17} r={5.5} fill={t.color.category2} />
      <Path d="M29.5 26.6 a10.5 10.5 0 0 1 14.5 9.9 V38 H34 V36.5 a13 13 0 0 0 -4.5 -9.9 Z" fill={t.color.category2} />
      <Circle cx={18} cy={18.5} r={6.5} fill={t.color.action} />
      <Path d="M5 40 V37.5 a13 13 0 0 1 26 0 V40 a1.5 1.5 0 0 1 -1.5 1.5 H6.5 A1.5 1.5 0 0 1 5 40 Z" fill={t.color.action} />
    </G>
  ),
};

const financeOtherCost: FarmMateIconDef = {
  id: 'finance.otherCost',
  labelTh: 'ค่าใช้จ่ายอื่นๆ',
  category: 'finance',
  note: '฿ bill — other costs; close-out "จัดการหนี้" debt card',
  Render: (t) => (
    <G>
      <Path
        d="M13 6 H30 L37 13 V38 Q37 41 34 41 H29.5 Q27.5 38.6 25.5 41 H22.5 Q20.5 38.6 18.5 41 H14 Q11 41 11 38 V8 Q11 6 13 6 Z"
        fill="none"
        stroke={t.color.action}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <Path d="M29 7 V12 a2 2 0 0 0 2 2 H36 Z" fill={t.color.category2} />
      <BahtGlyph cx={24} cy={25} h={13} color={t.color.brandStrong} />
    </G>
  ),
};

const financeFinanceReport: FarmMateIconDef = {
  id: 'finance.financeReport',
  labelTh: 'รายงานการเงิน',
  category: 'finance',
  note: 'bars with rising trend — finance report screen',
  Render: (t) => (
    <G>
      <Rect x={13} y={34} width={5} height={8} rx={2.5} fill={t.color.action} />
      <Rect x={21.5} y={33} width={5} height={9} rx={2.5} fill={t.color.action} />
      <Rect x={35} y={24} width={5} height={18} rx={2.5} fill={t.color.action} />
      <Path d="M6 34 L17 22 L23 28 L39 10" stroke={t.color.brandStrong} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M32 9 H40 V17" stroke={t.color.brandStrong} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  ),
};

// ── หมวดผู้เกี่ยวข้อง — people ────────────────────────────────────────────────

const peopleManager: FarmMateIconDef = {
  id: 'people.manager',
  labelTh: 'ผู้จัดการสวน',
  category: 'people',
  note: 'farm manager / owner avatar',
  Render: (t) => (
    <G>
      <Path d="M9 44 V41 a7 7 0 0 1 7 -7 H32 a7 7 0 0 1 7 7 V44 Z" fill={t.color.brandStrong} />
      <Rect x={15} y={34.5} width={3} height={9.5} fill={t.color.action} />
      <Rect x={30} y={34.5} width={3} height={9.5} fill={t.color.action} />
      <Rect x={20.5} y={28} width={7} height={7} rx={2} fill={t.color.brandYellow} />
      <Path d="M15 19 V22 a9 9 0 0 0 18 0 V19 Z" fill={t.color.brandYellow} />
      <Path d="M15 17 H33 V23.5 Q31.5 21.5 30.5 23.5 V20.5 H17.5 V23.5 Q16.5 21.5 15 23.5 Z" fill={t.color.ink} />
      <Ellipse cx={24} cy={15} rx={20} ry={4.5} fill={t.color.category5} />
      <Path d="M13 15 a11 10 0 0 1 22 0 Z" fill={t.color.brandYellow} />
    </G>
  ),
};

const peopleTapper: FarmMateIconDef = {
  id: 'people.tapper',
  labelTh: 'คนกรีดยาง',
  category: 'people',
  note: 'tapper avatar — tapper rows on the close-out pages',
  Render: (t) => (
    <G>
      <Path d="M8 46 V42 a8 8 0 0 1 8 -8 H32 a8 8 0 0 1 8 8 V46 Z" fill={t.color.action} />
      <Rect x={15} y={35} width={3.4} height={11} fill={t.color.category2} />
      <Rect x={29.6} y={35} width={3.4} height={11} fill={t.color.category2} />
      <Rect x={17} y={40} width={14} height={6} rx={1.5} fill={t.color.category2Sunk} />
      <Rect x={20.5} y={29} width={7} height={6} rx={2} fill={t.color.brandYellow} />
      <Path d="M14 20 V23 a10 10 0 0 0 20 0 V20 Z" fill={t.color.brandYellow} />
      <Path d="M13 18.5 H35 V24 Q33.5 22 32.5 24 V21 H15.5 V24 Q14.5 22 13 24 Z" fill={t.color.ink} />
      <Path d="M12.5 19 a11.5 11.5 0 0 1 23 0 Z" fill={t.color.category5} />
    </G>
  ),
};

const peopleBuyer: FarmMateIconDef = {
  id: 'people.buyer',
  labelTh: 'ผู้ซื้อ/ลูกค้า',
  category: 'people',
  note: 'group of three — buyer / customer',
  Render: (t) => (
    <G>
      <Circle cx={10.5} cy={18} r={5} fill={t.color.brandStrong} />
      <Path d="M2.5 37 V32 a7 7 0 0 1 7 -7 H16 V37 a1.5 1.5 0 0 1 -1.5 1.5 H4 A1.5 1.5 0 0 1 2.5 37 Z" fill={t.color.brandStrong} />
      <Circle cx={37.5} cy={18} r={5} fill={t.color.category2} />
      <Path d="M32 25 H38.5 a7 7 0 0 1 7 7 V37 a1.5 1.5 0 0 1 -1.5 1.5 H33.5 A1.5 1.5 0 0 1 32 37 Z" fill={t.color.category2} />
      <Circle cx={24} cy={14.5} r={6.5} fill={t.color.brandStrong} stroke={t.color.surfaceRaised} strokeWidth={1.5} />
      <Path d="M13.5 39.5 V34 a10.5 10.5 0 0 1 21 0 V39.5 Z" fill={t.color.category1} stroke={t.color.surfaceRaised} strokeWidth={1.5} strokeLinejoin="round" />
    </G>
  ),
};

const peopleTransporter: FarmMateIconDef = {
  id: 'people.transporter',
  labelTh: 'ผู้ขนส่ง',
  category: 'people',
  note: 'truck — transporter / hauler',
  Render: (t) => (
    <G>
      <Rect x={3} y={10} width={25} height={22} rx={2} fill={t.color.category2} />
      <Path d="M30 17 H37.5 a1.5 1.5 0 0 1 1.2 0.6 L45 26 V33 H30 Z" fill={t.color.action} />
      <Path d="M32.5 20 H37 L40 25 H32.5 Z" fill={t.color.inkInverse} />
      <Rect x={3} y={30} width={42} height={4} rx={1} fill={t.color.action} />
      <Circle cx={12} cy={36} r={4.5} fill={t.color.action} stroke={t.color.inkInverse} strokeWidth={1.6} />
      <Circle cx={37} cy={36} r={4.5} fill={t.color.action} stroke={t.color.inkInverse} strokeWidth={1.6} />
    </G>
  ),
};

const peopleContacts: FarmMateIconDef = {
  id: 'people.contacts',
  labelTh: 'รายชื่อผู้ติดต่อ',
  category: 'people',
  note: 'address book — contacts list',
  Render: (t) => (
    <G>
      <Rect x={10} y={4} width={33} height={40} rx={4} fill={t.color.category2} />
      {[11, 22, 33].map((y) => (
        <G key={y}>
          <Rect x={6.5} y={y} width={5} height={5} rx={1.4} fill={t.color.category2} />
          <Ellipse cx={13.5} cy={y + 2.5} rx={1} ry={1.4} fill={t.color.inkInverse} />
        </G>
      ))}
      <Circle cx={28} cy={18} r={5.5} fill={t.color.inkInverse} />
      <Path d="M19 34 a9 9 0 0 1 18 0 Z" fill={t.color.inkInverse} />
    </G>
  ),
};

const peopleCommsLog: FarmMateIconDef = {
  id: 'people.commsLog',
  labelTh: 'บันทึกการสื่อสาร',
  category: 'people',
  note: 'speech bubble — communication log',
  Render: (t) => (
    <G>
      <Ellipse cx={24.5} cy={20.5} rx={19} ry={15.5} fill={t.color.category2} />
      <Path d="M9 28 L8.5 42 Q8.5 43 9.5 42.5 L21 35 Z" fill={t.color.category2} />
      {[17, 24.5, 32].map((cx) => (
        <Circle key={cx} cx={cx} cy={20.5} r={2.4} fill={t.color.inkInverse} />
      ))}
    </G>
  ),
};

const peopleWorkerInfo: FarmMateIconDef = {
  id: 'people.workerInfo',
  labelTh: 'ข้อมูลคนงาน',
  category: 'people',
  note: 'ID card — worker details screen',
  Render: (t) => (
    <G>
      <Rect x={5.5} y={10.5} width={37} height={27} rx={5} fill="none" stroke={t.color.action} strokeWidth={3.2} />
      <Circle cx={17} cy={20} r={3.6} fill={t.color.action} />
      <Path d="M11 30.5 a6 5.5 0 0 1 12 0 Z" fill={t.color.action} />
      <Rect x={26.5} y={18} width={9} height={3} rx={1.5} fill={t.color.action} />
      <Rect x={26.5} y={25} width={9} height={3} rx={1.5} fill={t.color.action} />
    </G>
  ),
};

const peopleProfitShare: FarmMateIconDef = {
  id: 'people.profitShare',
  labelTh: 'แบ่งผลประโยชน์',
  category: 'people',
  note: 'handshake — profit share; close-out "จัดเงินสดกับคนรับซื้อยาง" card',
  Render: (t) => (
    <G>
      <Rect x={3} y={13} width={6} height={13} rx={1} fill={t.color.action} transform="rotate(-28 6 19.5)" />
      <Rect x={39} y={13} width={6} height={13} rx={1} fill={t.color.brandStrong} transform="rotate(28 42 19.5)" />
      {[
        [12.5, 30],
        [16, 33],
        [20, 35.5],
        [24.5, 36.5],
      ].map(([x, y]) => (
        <Rect key={x} x={x - 1.8} y={y - 3.6} width={3.6} height={7.2} rx={1.8} fill={t.color.brandYellow} transform={`rotate(45 ${x} ${y})`} />
      ))}
      <Path d="M10 18 L18 14.5 H25 L34 24.5 Q35.5 27 33 28.5 L28 32 H20 L12 26 Z" fill={t.color.brandYellow} />
      <Path d="M38 18 L30 14.5 H24.5 L17 21 Q16 23.5 18.5 24 L24 21 L32.5 28.5 L38 24 Z" fill={t.color.category5} />
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
  financeIncome,
  financeExpense,
  financeProfitCost,
  financeSummary,
  financeSplit50,
  financeWorkerPay,
  financeOtherCost,
  financeFinanceReport,
  peopleManager,
  peopleTapper,
  peopleBuyer,
  peopleTransporter,
  peopleContacts,
  peopleCommsLog,
  peopleWorkerInfo,
  peopleProfitShare,
];

export const FARMMATE_ICON_CATEGORY_LABEL_TH: Record<FarmMateIconCategory, string> = {
  nav: 'หมวดหลัก / นำทาง',
  farm: 'หมวดสวนและแปลง',
  sale: 'หมวดผลผลิตและการขาย',
  finance: 'หมวดการเงิน',
  people: 'หมวดผู้เกี่ยวข้อง',
};

export function getFarmMateIcon(id: string): FarmMateIconDef | undefined {
  return FARMMATE_ICONS.find((icon) => icon.id === id);
}

export { Svg, VB as FARMMATE_ICON_VIEWBOX };
