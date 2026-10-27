/**
 * E11-S11 strings for one worker's area. Thai is the source; English is partial. Spread into `messages.ts`.
 * Keep keys under this file's prefix so parallel workers never touch the same lines.
 */
export const th = {
  // ── DatePickerSheet (FO-8) ───────────────────────────────────────────────
  'datepick.title': 'เลือกวัน',
  'datepick.today': 'วันนี้',
  'datepick.yesterday': 'เมื่อวาน',
  'datepick.twoDaysAgo': '2 วันก่อน',
  'datepick.prev': 'เดือนก่อน',
  'datepick.next': 'เดือนถัดไป',
  'datepick.done': 'ตกลง · {weekday} {day} {month} {year}',
  'datepick.dayA11y': '{weekday} {day} {month} {year}',
  'datepick.wd0': 'อา',
  'datepick.wd1': 'จ',
  'datepick.wd2': 'อ',
  'datepick.wd3': 'พ',
  'datepick.wd4': 'พฤ',
  'datepick.wd5': 'ศ',
  'datepick.wd6': 'ส',
  'datepick.monthName1': 'มกราคม',
  'datepick.monthName2': 'กุมภาพันธ์',
  'datepick.monthName3': 'มีนาคม',
  'datepick.monthName4': 'เมษายน',
  'datepick.monthName5': 'พฤษภาคม',
  'datepick.monthName6': 'มิถุนายน',
  'datepick.monthName7': 'กรกฎาคม',
  'datepick.monthName8': 'สิงหาคม',
  'datepick.monthName9': 'กันยายน',
  'datepick.monthName10': 'ตุลาคม',
  'datepick.monthName11': 'พฤศจิกายน',
  'datepick.monthName12': 'ธันวาคม',
} as const;
export const en: Record<string, string> = {
  'datepick.title': 'Pick a day',
  'datepick.today': 'Today',
  'datepick.yesterday': 'Yesterday',
  'datepick.twoDaysAgo': '2 days ago',
  'datepick.prev': 'Previous month',
  'datepick.next': 'Next month',
  'datepick.done': 'OK · {weekday} {day} {month} {year}',
};
