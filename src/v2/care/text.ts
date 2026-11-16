/** Text shared by the garden-care pages (care list, stock). */

import { formatDate } from '../../core/finance/money';

/** "15-15-15" never breaks at a dash (owner 2026-11-16): a word joiner on each side of every dash. */
export const keepFormula = (name: string) => name.replace(/-/g, '⁠-⁠');

/** "5 พ.ย." in `year`, "5 พ.ย. 2568" in another year (review of PR 189 N1, PR 190 item 3). */
export const rowDate = (iso: string, year: string) => (iso.startsWith(year) ? formatDate(iso).split(' ').slice(0, 2).join(' ') : formatDate(iso));
