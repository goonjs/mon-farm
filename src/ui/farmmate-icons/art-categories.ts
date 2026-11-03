/**
 * The nine groups of the traced FarmMate originals, in the reference sheet's
 * order (E03-S11). An icon's group is the part of its id before the dot
 * (`sale.weigh` → `sale`). Thai headings are for the /v2/dev/icons catalogue.
 */
export const FARMMATE_ART_CATEGORIES = [
  { key: 'nav', labelTh: 'หมวดหลัก / นำทาง' },
  { key: 'farm', labelTh: 'หมวดสวนและแปลง' },
  { key: 'sale', labelTh: 'หมวดผลผลิตและการขาย' },
  { key: 'farmwork', labelTh: 'หมวดงานในสวน' },
  { key: 'materials', labelTh: 'หมวดวัสดุและปุ๋ย' },
  { key: 'finance', labelTh: 'หมวดการเงิน' },
  { key: 'analysis', labelTh: 'หมวดรายงานและวิเคราะห์' },
  { key: 'people', labelTh: 'หมวดผู้เกี่ยวข้อง' },
  { key: 'system', labelTh: 'หมวดระบบ' },
] as const;
