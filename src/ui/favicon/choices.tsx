/**
 * The tab icons a person can pick on "เครื่องนี้" (E03-S10): 20 of the traced
 * FarmMate originals in design/icons/farmmate — owner 2026-11-02: the
 * originals, not the simplified redraw in src/ui/farmmate-icons; no Expo
 * icon; กรีดยาง is the default, and app.json ships it as the page's favicon. Chosen from all 72 by
 * looking at them at 16 and 32 px on light and dark tab strips: bold shapes,
 * rubber-farm work first.
 *
 * Each is pre-rendered by `npm run favicons` (scripts/render-favicons.mjs) to
 * three PNGs in assets/favicons, which ship with the build (FV-2: nothing is
 * drawn or fetched from elsewhere at run time):
 *   tab  64 px, on a light rounded tile so it shows on a dark tab strip
 *   home 180 px, square light tile (apple-touch-icon; iOS rounds it itself)
 *   grid 128 px, the icon alone, for the picker
 * Labels are the originals' Thai names (design/icons/farmmate/manifest.json).
 */

import type { ImageSourcePropType } from 'react-native';

/** What `require()` of a PNG gives: `{ uri }` on the web, a number on native. */
export type PngAsset = ImageSourcePropType;

export interface Favicon {
  readonly label: string;
  readonly tab: PngAsset;
  readonly home: PngAsset;
  readonly grid: PngAsset;
}

/** Also app.json `web.favicon` (a test keeps the two together). */
export const FAVICON_DEFAULT = 'farmwork.tapping';

// Metro bundles an asset only from a literal require().
export const FAVICONS: Readonly<Record<string, Favicon>> = {
  'farmwork.tapping': {
    label: 'กรีดยาง',
    tab: require('../../../assets/favicons/farmwork.tapping-64.png'),
    home: require('../../../assets/favicons/farmwork.tapping-180.png'),
    grid: require('../../../assets/favicons/farmwork.tapping-128.png'),
  },
  'people.tapper': {
    label: 'คนกรีดยาง',
    tab: require('../../../assets/favicons/people.tapper-64.png'),
    home: require('../../../assets/favicons/people.tapper-180.png'),
    grid: require('../../../assets/favicons/people.tapper-128.png'),
  },
  'sale.recordYield': {
    label: 'บันทึกผลผลิต',
    tab: require('../../../assets/favicons/sale.recordYield-64.png'),
    home: require('../../../assets/favicons/sale.recordYield-180.png'),
    grid: require('../../../assets/favicons/sale.recordYield-128.png'),
  },
  'sale.weigh': {
    label: 'ชั่งน้ำหนัก',
    tab: require('../../../assets/favicons/sale.weigh-64.png'),
    home: require('../../../assets/favicons/sale.weigh-180.png'),
    grid: require('../../../assets/favicons/sale.weigh-128.png'),
  },
  'sale.rubberPrice': {
    label: 'ราคายาง',
    tab: require('../../../assets/favicons/sale.rubberPrice-64.png'),
    home: require('../../../assets/favicons/sale.rubberPrice-180.png'),
    grid: require('../../../assets/favicons/sale.rubberPrice-128.png'),
  },
  'farmwork.fertilize': {
    label: 'ใส่ปุ๋ย',
    tab: require('../../../assets/favicons/farmwork.fertilize-64.png'),
    home: require('../../../assets/favicons/farmwork.fertilize-180.png'),
    grid: require('../../../assets/favicons/farmwork.fertilize-128.png'),
  },
  'materials.manureFert': {
    label: 'ปุ๋ยมูลไก่',
    tab: require('../../../assets/favicons/materials.manureFert-64.png'),
    home: require('../../../assets/favicons/materials.manureFert-180.png'),
    grid: require('../../../assets/favicons/materials.manureFert-128.png'),
  },
  'farmwork.mow': {
    label: 'ตัดหญ้า',
    tab: require('../../../assets/favicons/farmwork.mow-64.png'),
    home: require('../../../assets/favicons/farmwork.mow-180.png'),
    grid: require('../../../assets/favicons/farmwork.mow-128.png'),
  },
  'farmwork.spray': {
    label: 'ฉีดยา/กำจัดวัชพืช',
    tab: require('../../../assets/favicons/farmwork.spray-64.png'),
    home: require('../../../assets/favicons/farmwork.spray-180.png'),
    grid: require('../../../assets/favicons/farmwork.spray-128.png'),
  },
  'farm.treeCondition': {
    label: 'สภาพต้นยาง',
    tab: require('../../../assets/favicons/farm.treeCondition-64.png'),
    home: require('../../../assets/favicons/farm.treeCondition-180.png'),
    grid: require('../../../assets/favicons/farm.treeCondition-128.png'),
  },
  'nav.myFarm': {
    label: 'สวนของฉัน',
    tab: require('../../../assets/favicons/nav.myFarm-64.png'),
    home: require('../../../assets/favicons/nav.myFarm-180.png'),
    grid: require('../../../assets/favicons/nav.myFarm-128.png'),
  },
  'farm.allFarms': {
    label: 'สวนทั้งหมด',
    tab: require('../../../assets/favicons/farm.allFarms-64.png'),
    home: require('../../../assets/favicons/farm.allFarms-180.png'),
    grid: require('../../../assets/favicons/farm.allFarms-128.png'),
  },
  'farm.plotZone': {
    label: 'แปลง/โซน',
    tab: require('../../../assets/favicons/farm.plotZone-64.png'),
    home: require('../../../assets/favicons/farm.plotZone-180.png'),
    grid: require('../../../assets/favicons/farm.plotZone-128.png'),
  },
  'materials.stock': {
    label: 'สต็อกวัสดุ',
    tab: require('../../../assets/favicons/materials.stock-64.png'),
    home: require('../../../assets/favicons/materials.stock-180.png'),
    grid: require('../../../assets/favicons/materials.stock-128.png'),
  },
  'people.transporter': {
    label: 'ผู้ขนส่ง',
    tab: require('../../../assets/favicons/people.transporter-64.png'),
    home: require('../../../assets/favicons/people.transporter-180.png'),
    grid: require('../../../assets/favicons/people.transporter-128.png'),
  },
  'finance.income': {
    label: 'รายรับ',
    tab: require('../../../assets/favicons/finance.income-64.png'),
    home: require('../../../assets/favicons/finance.income-180.png'),
    grid: require('../../../assets/favicons/finance.income-128.png'),
  },
  'sale.sale': {
    label: 'การขาย',
    tab: require('../../../assets/favicons/sale.sale-64.png'),
    home: require('../../../assets/favicons/sale.sale-180.png'),
    grid: require('../../../assets/favicons/sale.sale-128.png'),
  },
  'nav.home': {
    label: 'หน้าแรก',
    tab: require('../../../assets/favicons/nav.home-64.png'),
    home: require('../../../assets/favicons/nav.home-180.png'),
    grid: require('../../../assets/favicons/nav.home-128.png'),
  },
  'nav.notifications': {
    label: 'แจ้งเตือน',
    tab: require('../../../assets/favicons/nav.notifications-64.png'),
    home: require('../../../assets/favicons/nav.notifications-180.png'),
    grid: require('../../../assets/favicons/nav.notifications-128.png'),
  },
  'system.sync': {
    label: 'ซิงค์ข้อมูล',
    tab: require('../../../assets/favicons/system.sync-64.png'),
    home: require('../../../assets/favicons/system.sync-180.png'),
    grid: require('../../../assets/favicons/system.sync-128.png'),
  },
};

export const FAVICON_CHOICES: readonly string[] = Object.keys(FAVICONS);

export function faviconLabel(id: string): string | undefined {
  return Object.hasOwn(FAVICONS, id) ? FAVICONS[id].label : undefined;
}
