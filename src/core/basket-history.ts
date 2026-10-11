/**
 * The basket list's own figures (E04-S15): the summary line and the filters.
 * Rows come from `basketList` — nothing is recomputed here.
 */

import type { BasketRow } from './sale-points';

export type HistoryKind = 'all' | 'full' | 'short';

export interface HistoryFilter {
  readonly kind: HistoryKind;
  /** Only the baskets of this tapper's points; null = everyone. */
  readonly tapperId: string | null;
}

export interface HistorySummary {
  readonly full: number;
  readonly short: number;
  readonly netG: number;
}

/** Live baskets only: a voided row stays in the list but not in the totals (SALE-17). */
export function historySummary(rows: readonly BasketRow[]): HistorySummary {
  let full = 0;
  let short = 0;
  let netG = 0;
  for (const r of rows) {
    if (r.status !== 'live') continue;
    if (r.short) short += 1;
    else full += 1;
    netG += r.netG;
  }
  return { full, short, netG };
}

export function filterHistory(rows: readonly BasketRow[], f: HistoryFilter, tapperOf: (pointId: string) => string | null): readonly BasketRow[] {
  return rows.filter((r) => {
    if (f.kind === 'full' && r.short) return false;
    if (f.kind === 'short' && !r.short) return false;
    return f.tapperId === null || tapperOf(r.pointId) === f.tapperId;
  });
}

export interface HistoryEquation {
  /** Full baskets grouped by weight, heaviest first: "21 × 50". */
  readonly full: readonly { readonly count: number; readonly eachG: number }[];
  /** Short baskets one by one, newest first. */
  readonly shortsG: readonly number[];
  readonly totalG: number;
}

/** The sum a person can check against the buyer's slip or the paper (E04-S15). Live baskets only. */
export function historyEquation(rows: readonly BasketRow[]): HistoryEquation {
  const byWeight = new Map<number, number>();
  const shortsG: number[] = [];
  let totalG = 0;
  for (const r of rows) {
    if (r.status !== 'live') continue;
    totalG += r.netG;
    if (r.short) shortsG.push(r.netG);
    else byWeight.set(r.netG, (byWeight.get(r.netG) ?? 0) + 1);
  }
  const full = [...byWeight].map(([eachG, count]) => ({ count, eachG })).sort((a, b) => b.eachG - a.eachG);
  return { full, shortsG, totalG };
}

/** The total up to and including each live basket; `rowsNewestFirst` is the list as shown. */
export function runningTotals(rowsNewestFirst: readonly BasketRow[]): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  let sum = 0;
  for (const r of [...rowsNewestFirst].reverse()) {
    if (r.status !== 'live') continue;
    sum += r.netG;
    out.set(r.id, sum);
  }
  return out;
}

export interface NumberProblem {
  readonly scope: string;
  readonly gaps: readonly number[];
  readonly dups: readonly number[];
}

/**
 * Basket numbers must run 1…n in each numbering scope (a tapper, or a point)
 * with none missing and none twice — what the owner wants confirmed after
 * merging two devices or taking a basket back (E04-S15). Live baskets only; an
 * undone number is simply used again, a voided one leaves its gap.
 */
export function checkNumbers(rows: readonly BasketRow[], scopeOf: (pointId: string) => string): { ok: boolean; problems: readonly NumberProblem[] } {
  const seen = new Map<string, Map<number, number>>();
  for (const r of rows) {
    if (r.status !== 'live') continue;
    const scope = scopeOf(r.pointId);
    const counts = seen.get(scope) ?? new Map<number, number>();
    counts.set(r.basketNo, (counts.get(r.basketNo) ?? 0) + 1);
    seen.set(scope, counts);
  }
  const problems: NumberProblem[] = [];
  for (const [scope, counts] of seen) {
    const max = Math.max(...counts.keys());
    const gaps: number[] = [];
    for (let n = 1; n <= max; n++) if (!counts.has(n)) gaps.push(n);
    const dups = [...counts].filter(([, c]) => c > 1).map(([n]) => n).sort((a, b) => a - b);
    if (gaps.length || dups.length) problems.push({ scope, gaps, dups });
  }
  return { ok: problems.length === 0, problems };
}
