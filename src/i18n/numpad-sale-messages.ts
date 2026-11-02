/**
 * E01-S20 strings for the sale screens' number fields. Thai is the source; English is complete.
 * Spread into `messages.ts`. Keys use the prefix `npsale.` so parallel workers never touch the same file.
 */
export const th = {
  'npsale.perKg': 'บาท / กก.',
  'npsale.basket': 'เข่ง',
  'npsale.closedPrice': 'การขายปิดแล้ว แก้ราคาไม่ได้',
} as const;

export const en: Record<keyof typeof th, string> = {
  'npsale.perKg': 'baht / kg',
  'npsale.basket': 'baskets',
  'npsale.closedPrice': 'the sale is closed; the price cannot change',
};
