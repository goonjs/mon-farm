/**
 * E01-S20 strings: the app number pad in every numeric field. Thai is the source; English is complete.
 * Spread into `messages.ts`. Kept in its own file so parallel stories never touch the same lines.
 */
export const th = {
  'numpad.keyBackHint': 'กดค้างเพื่อล้างทั้งช่อง',
  'numpad.unknown': 'ไม่ทราบ',
  'numpad.later': 'ใส่ทีหลัง',
  'numpad.clearUnknown': 'เว้นว่าง (ไม่ทราบ)',
  'numpad.clearLater': 'เว้นว่าง (ใส่ทีหลัง)',
  'numpad.clearNoShort': 'เว้นว่าง (ไม่มีเข่งไม่เต็ม)',
  'numpad.clearNone': 'เว้นว่าง (ไม่มี)',
  'numpad.guess': 'ค่าเดา · พิมพ์ทับ',
  'numpad.badYear': 'ปีไม่ถูกต้อง',
  'numpad.futureYear': 'ปีนี้ยังไม่ถึง',
  'numpad.unitBe': 'พ.ศ.',
  'numpad.unitCe': 'ค.ศ.',
} as const;

export const en: Record<keyof typeof th, string> = {
  'numpad.keyBackHint': 'hold to clear the field',
  'numpad.unknown': 'unknown',
  'numpad.later': 'set later',
  'numpad.clearUnknown': 'leave blank (unknown)',
  'numpad.clearLater': 'leave blank (set later)',
  'numpad.clearNoShort': 'leave blank (no part basket)',
  'numpad.clearNone': 'leave blank (none)',
  'numpad.guess': 'guess · type over',
  'numpad.badYear': 'not a valid year',
  'numpad.futureYear': 'that year has not come yet',
  'numpad.unitBe': 'BE',
  'numpad.unitCe': 'CE',
};
