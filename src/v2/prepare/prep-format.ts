/**
 * Text helpers the prep page and the start-sale page share (E15-S01, E15-S02).
 */

import { formatThaiDay } from '../../core/master';

/** "ส. 21 พ.ย. 2569" for an ISO day; `short` drops the year ("ส. 21 พ.ย.") for a one-line summary. */
export function prepDayText(iso: string, era: 'be' | 'ce', short = false): string {
  const [y, m, d] = iso.split('-').map(Number);
  const text = formatThaiDay(Date.UTC(y, m - 1, d, 5), era);
  // The short form stays on one line: its spaces do not break ("ส. 21 พ.ย." splits badly).
  return short ? text.replace(/ \d{4}$/, '').replace(/ /g, '\u00a0') : text;
}

/**
 * "52.50 ฿/กก." stays whole: no break before ฿ nor after the slash (a no-break space and a word joiner, added
 * here because the catalogue keeps to printable symbols).
 */
export const keepPerKg = (text: string) => text.replace(/ ฿\/(?=\S)/g, '\u00a0฿/\u2060');
