/**
 * E11-S11 strings for one worker's area. Thai is the source; English is partial. Spread into `messages.ts`.
 * Keep keys under this file's prefix so parallel workers never touch the same lines.
 */
export const th = {
  'ords.rowTitle': 'ปุ๋ย {n} รายการ',
  'ords.rowCaption': '{shop} · {date}',
  'ords.progress': 'บอกรายละเอียดแล้ว {done} / {total}',
  'ords.ordered': 'สั่งไว้',
  'ords.homeBuy': 'ซื้อของร้าน',
  'ords.homeDelivered': 'ปุ๋ยที่สั่งไว้ ของมาแล้วหรือยัง · ใบ {date}',
  'ords.homeDeliveredMany': 'ปุ๋ยที่สั่งไว้ ของมาแล้วหรือยัง · {n} ใบ',
  'ords.homeZones': 'ปุ๋ยยังไม่ได้บอกว่าใส่ที่ไหน · {n} รายการ',
} as const;
export const en: Record<string, string> = {
  'ords.rowTitle': 'Fertilizer, {n} items',
  'ords.rowCaption': '{shop} · {date}',
  'ords.progress': 'Details told {done} / {total}',
  'ords.ordered': 'Ordered',
  'ords.homeBuy': 'Buy from a shop',
  'ords.homeDelivered': 'Ordered fertilizer: has it arrived? · order of {date}',
  'ords.homeDeliveredMany': 'Ordered fertilizer: has it arrived? · {n} orders',
  'ords.homeZones': 'Fertilizer not yet placed on a plot · {n} items',
};
