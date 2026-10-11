/**
 * Calendar dates for display (D-74 F14).
 *
 * A date is the date ON THE FARM: Bangkok, UTC+7, which has no daylight
 * saving. A phone set to another timezone (a visitor, a mis-set clock zone)
 * must not move a sale to the previous day. Thai documents count years in the
 * Buddhist Era by default; the person can switch the whole app to the Common
 * Era, which is a presentation choice only — stored timestamps never change.
 */

export type Era = 'be' | 'ce';

export const BE_OFFSET = 543;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface DateParts {
  readonly day: number;
  /** 1–12 */
  readonly month: number;
  readonly year: number;
}

export function dateParts(ts: number, era: Era): DateParts {
  const d = new Date(ts + BANGKOK_OFFSET_MS);
  const ce = d.getUTCFullYear();
  return { day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: era === 'be' ? ce + BE_OFFSET : ce };
}

/**
 * The time on the farm (Bangkok), to the second — "07:46:12" (E04-S15: the
 * basket list shows when each basket was recorded, seconds included).
 */
export function clockSeconds(ts: number): string {
  const d = new Date(ts + BANGKOK_OFFSET_MS);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
