/**
 * Catching up from the paper (E04-S19): someone arrives late and enters the
 * baskets already weighed, point by point in weighing order, then counts
 * live. Every basket is an ordinary event, so totals, history and the
 * open-basket rules apply as if it had been counted live.
 */

import { tapperOn, type MasterState } from './master';
import { nextBasketNo } from './sale-points';
import type { NumberingMode, SaleEvent } from './types';

export interface CatchUpPoint {
  readonly pointId: string;
  /** The last basket number at this point, short or not ("จบที่เข่ง"). */
  readonly endNo: number;
  /** Net grams of that last basket when it was short; null = full. */
  readonly lastShortG: number | null;
  /** Grams added here to the basket the previous point left short; 0 = not topped up; null = not answered. */
  readonly topUpG: number | null;
  /** This point's basket pair, when it differs from the options' (review B1): its pile's, as the fold reads it. */
  readonly pair?: { readonly stdNetG: number; readonly tareG: number };
}

export type CatchUpDraft =
  | { readonly kind: 'accept'; readonly pointId: string; readonly basketNo: number; readonly netG: number; readonly tareG: number; readonly partOf?: number }
  | { readonly kind: 'short'; readonly pointId: string; readonly basketNo: number; readonly netG: number; readonly tareG: number }
  | { readonly kind: 'close'; readonly root: number };

export type CatchUpRow =
  | { readonly kind: 'full'; readonly pointId: string; readonly from: number; readonly to: number; readonly count: number; readonly netG: number }
  | {
      readonly kind: 'short';
      readonly pointId: string;
      readonly basketNo: number;
      readonly firstG: number;
      readonly topUps: readonly { readonly pointId: string; readonly g: number }[];
      readonly netG: number;
      readonly status: 'full' | 'closed' | 'open';
    };

export interface CatchUpPlan {
  readonly drafts: readonly CatchUpDraft[];
  readonly rows: readonly CatchUpRow[];
  readonly totalG: number;
  readonly baskets: number;
  readonly lastNo: number;
}

export interface CatchUpOptions {
  readonly mode: NumberingMode;
  readonly firstNo: number;
  readonly stdNetG: number;
  readonly tareG: number;
}

/** A basket can take at most one and a half full ones, as the live short sheet allows. */
const MAX_FILL = 1.5;

/**
 * The baskets to write for the points entered, in weighing order, or null
 * when something cannot be right (an end before the start, a short basket
 * not between 0 and full, a basket left short not answered at the next
 * point, a top-up past 1.5 full baskets).
 *
 * Continuous per tapper: numbers run on from `firstNo`. A basket a point ends
 * short on is asked about at the next point: topped up there (a part with
 * `partOf`, as live counting writes it), or closed. A top-up that still does
 * not reach full carries on to the next point only when this point starts no
 * basket of its own (`endNo` = its start − 1); otherwise it closes short.
 * The last point's short basket stays open, to fill when counting live.
 * Per point: each point starts at 1 and keeps its own open short basket.
 */
export function catchUpPlan(points: readonly CatchUpPoint[], o: CatchUpOptions): CatchUpPlan | null {
  if (!points.length) return null;
  const perPoint = o.mode === 'per-point';
  const drafts: CatchUpDraft[] = [];
  const rows: CatchUpRow[] = [];
  let next = perPoint ? 1 : o.firstNo;
  // A carried basket keeps its first point's standard and tare: the fold judges it by its root pile (bridge.ts).
  type Carried = { draft: number; row: number; haveG: number; stdNetG: number; tareG: number };
  let carried: Carried | null = null;
  let baskets = 0;
  let lastNo = next - 1;
  const setRow = (i: number, patch: Partial<Extract<CatchUpRow, { kind: 'short' }>>) => {
    rows[i] = { ...(rows[i] as Extract<CatchUpRow, { kind: 'short' }>), ...patch };
  };

  for (const p of points) {
    if (perPoint) next = 1;
    const std = p.pair?.stdNetG ?? o.stdNetG;
    const tare = p.pair?.tareG ?? o.tareG;
    const start = next;
    const topUpOnly = !perPoint && p.endNo === start - 1;
    if (p.endNo < start && !topUpOnly) return null;
    if (topUpOnly && !carried) return null;

    if (carried) {
      if (p.topUpG === null || p.topUpG < 0) return null;
      const row = rows[carried.row] as Extract<CatchUpRow, { kind: 'short' }>;
      if (p.topUpG === 0) {
        drafts.push({ kind: 'close', root: carried.draft });
        setRow(carried.row, { status: 'closed' });
        carried = null;
      } else {
        const haveG: number = carried.haveG + p.topUpG;
        if (haveG > carried.stdNetG * MAX_FILL) return null;
        drafts.push({ kind: 'accept', pointId: p.pointId, basketNo: row.basketNo, netG: p.topUpG, tareG: carried.tareG, partOf: carried.draft });
        const full: boolean = haveG >= carried.stdNetG;
        setRow(carried.row, { topUps: [...row.topUps, { pointId: p.pointId, g: p.topUpG }], netG: haveG, status: full ? 'full' : 'open' });
        carried = full ? null : { draft: carried.draft, row: carried.row, haveG, stdNetG: carried.stdNetG, tareG: carried.tareG };
      }
    }
    if (topUpOnly) continue;
    // Still short after a top-up, and this point goes on with new baskets: it closed short here.
    if (carried) {
      drafts.push({ kind: 'close', root: carried.draft });
      setRow(carried.row, { status: 'closed' });
      carried = null;
    }

    const short = p.lastShortG;
    if (short !== null && (!(short > 0) || short >= std)) return null;
    const fullTo = short === null ? p.endNo : p.endNo - 1;
    for (let n = start; n <= fullTo; n++) drafts.push({ kind: 'accept', pointId: p.pointId, basketNo: n, netG: std, tareG: tare });
    if (fullTo >= start) rows.push({ kind: 'full', pointId: p.pointId, from: start, to: fullTo, count: fullTo - start + 1, netG: (fullTo - start + 1) * std });
    if (short !== null) {
      drafts.push({ kind: 'short', pointId: p.pointId, basketNo: p.endNo, netG: short, tareG: tare });
      rows.push({ kind: 'short', pointId: p.pointId, basketNo: p.endNo, firstG: short, topUps: [], netG: short, status: 'open' });
      // Per point, a short basket stays at its own point: nothing carries to the next.
      if (!perPoint) carried = { draft: drafts.length - 1, row: rows.length - 1, haveG: short, stdNetG: std, tareG: tare };
    }
    baskets += p.endNo - start + 1;
    lastNo = Math.max(lastNo, p.endNo);
    next = p.endNo + 1;
  }

  const totalG = rows.reduce((sum, r) => sum + r.netG, 0);
  return { drafts, rows, totalG, baskets, lastNo };
}

/**
 * Appends a plan's baskets in order through the app's one write path. A
 * top-up and a close name their basket by the id `append` gave it.
 */
export function writeCatchUp(drafts: readonly CatchUpDraft[], append: (body: Record<string, unknown>) => string): void {
  const ids: string[] = [];
  for (const d of drafts) {
    if (d.kind === 'close') {
      ids.push(append({ kind: 'sys', payload: { t: 'basket_closed', basketId: ids[d.root], reason: 'next' } }));
    } else if (d.kind === 'short') {
      // Stored as a reading like any short basket (reading − basket = net).
      ids.push(append({ kind: 'short', pileId: d.pointId, pointId: d.pointId, basketNo: d.basketNo, readingG: d.netG + d.tareG, tareG: d.tareG, afterwards: true }));
    } else {
      ids.push(append({ kind: 'accept', pileId: d.pointId, pointId: d.pointId, basketNo: d.basketNo, input: 'backfill', netG: d.netG, tareG: d.tareG, ...(d.partOf !== undefined ? { partOf: ids[d.partOf] } : {}) }));
    }
  }
}

/**
 * Catching up comes before counting live (owner 2026-11-16): allowed while
 * the point's number sequence — its tapper's, or the point's own — has no
 * basket yet.
 */
export function catchUpAllowed(events: readonly SaleEvent[], master: MasterState, day: string, pointId: string, mode: NumberingMode): boolean {
  return nextBasketNo(events, pointId, mode, (id) => tapperOn(master, id, day)) === 1;
}
