/**
 * The tab icons a person can pick on "เครื่องนี้" (E03-S10): 20 of the traced
 * FarmMate originals in design/icons/farmmate — owner 2026-11-02: the
 * originals, not the simplified redraw in src/ui/farmmate-icons; no Expo
 * icon; กรีดยาง is the default, and app.json ships it as the page's favicon. Chosen from all 72 by
 * looking at them at 16 and 32 px on light and dark tab strips: bold shapes,
 * rubber-farm work first.
 *
 * This file is platform-neutral (ids and Thai labels — the originals' names in
 * design/icons/farmmate/manifest.json). The PNGs are in `pngs.web.ts`, so only
 * the web build carries them.
 */

/** Also app.json `web.favicon` (a test keeps the two together). */
export const FAVICON_DEFAULT = 'farmwork.tapping';

/** id → Thai name, in the order the picker shows them. */
const LABELS: Readonly<Record<string, string>> = {
  'farmwork.tapping': 'กรีดยาง',
  'people.tapper': 'คนกรีดยาง',
  'sale.recordYield': 'บันทึกผลผลิต',
  'sale.weigh': 'ชั่งน้ำหนัก',
  'sale.rubberPrice': 'ราคายาง',
  'farmwork.fertilize': 'ใส่ปุ๋ย',
  'materials.manureFert': 'ปุ๋ยมูลไก่',
  'farmwork.mow': 'ตัดหญ้า',
  'farmwork.spray': 'ฉีดยา/กำจัดวัชพืช',
  'farm.treeCondition': 'สภาพต้นยาง',
  'nav.myFarm': 'สวนของฉัน',
  'farm.allFarms': 'สวนทั้งหมด',
  'farm.plotZone': 'แปลง/โซน',
  'materials.stock': 'สต็อกวัสดุ',
  'people.transporter': 'ผู้ขนส่ง',
  'finance.income': 'รายรับ',
  'sale.sale': 'การขาย',
  'nav.home': 'หน้าแรก',
  'nav.notifications': 'แจ้งเตือน',
  'system.sync': 'ซิงค์ข้อมูล',
};

export const FAVICON_CHOICES: readonly string[] = Object.keys(LABELS);

export function faviconLabel(id: string): string | undefined {
  return Object.hasOwn(LABELS, id) ? LABELS[id] : undefined;
}
