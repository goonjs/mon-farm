/**
 * Money and date presentation for the finance ledger (E11).
 *
 * Satang are integers end to end. Parsing goes through the string, never
 * through `Number(baht) * 100`: `1.15 * 100` is `114.99999999999999`, and a
 * ledger two people sign off on cannot round its way to the right answer.
 */

const BAHT = /^(\d+)(?:\.(\d{1,2}))?$/;

/** "1,234.56" → 123456. Null for anything that is not a non-negative amount with ≤ 2 decimals. */
export function parseBahtToSatang(input: string): number | null {
  const m = BAHT.exec(input.trim().replace(/,/g, ''));
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? '').padEnd(2, '0'));
  const satang = whole * 100 + frac;
  return Number.isSafeInteger(satang) ? satang : null;
}

/** 123456 → "1,234.56"; a negative amount carries a real minus sign. */
export function formatSatang(satang: number): string {
  const sign = satang < 0 ? '−' : '';
  const abs = Math.abs(satang);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${whole}.${String(abs % 100).padStart(2, '0')}`;
}

/** Satang as a plain input value ("640.00") — no separators, so it parses back. */
export function satangToInput(satang: number): string {
  return `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, '0')}`;
}

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export type Era = 'be' | 'ce';

/** "2026-09-28" → "28 ก.ย. 2569" (พ.ศ., the default — D-65) or "28 ก.ย. 2026". */
export function formatDate(iso: string, era: Era = 'be'): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_TH[m - 1]} ${era === 'be' ? y + 543 : y}`;
}

/** "2026-09" → "ก.ย. 2569". */
export function formatMonth(month: string, era: Era = 'be'): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return `${MONTHS_TH[m - 1]} ${era === 'be' ? y + 543 : y}`;
}

/** "YYYY-MM" with a real month (01–12). A month like "2025-13" would never be reached by counting up. */
export function isMonth(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

/** "YYYY-MM-DD" that is a real calendar day. */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Today as "YYYY-MM-DD" in the device's local calendar. */
export function todayIso(now: Date = new Date()): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
