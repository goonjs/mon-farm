/**
 * Short baskets that stay open and carry on at another point (E04-S06,
 * SALE-9…13, D-42, D-57).
 *
 * A short basket is open by default. Its later parts are ordinary basket
 * events with `partOf` (same number, weighed at another point of the same
 * tapper); each point's totals keep only its own part. It closes full by
 * itself once its parts reach the standard net (owner 2026-10-03), or short
 * with `basket_closed`: "จบเข่งแล้ว / เป็นเศษ", a move to another tapper's
 * point (SALE-12, no question asked), or "start the next full basket".
 */

import { tapperOn, type MasterState } from './master';
import { compareEvents } from './order';
import { basketNetG, liveBaskets } from './totals';
import type { BasketEvent, NumberingMode, SaleEvent } from './types';

export interface BasketGroup {
  readonly rootId: string;
  readonly basketNo: number;
  /** Where the first part was weighed. */
  readonly pointId: string;
  readonly parts: readonly BasketEvent[];
  /** Each part's net, in order: "(20 + 30) กก." */
  readonly partsG: readonly number[];
  readonly netG: number;
  readonly status: 'open' | 'full' | 'closed';
}

/**
 * Point baskets that started short, with their parts. `stdNetGOf` is the
 * standard net of a pile. With `sequenceOf` (the number sequence of a point),
 * a short basket is also closed once a later basket of its sequence exists —
 * logs from before E04-S06, and a basket the recorder already moved past.
 */
export function basketGroups(
  events: readonly SaleEvent[],
  stdNetGOf: (pileId: string) => number,
  sequenceOf?: (pointId: string) => string,
): Map<string, BasketGroup> {
  const live = liveBaskets(events);
  const closed = new Set<string>();
  for (const e of [...events].sort(compareEvents)) {
    if (e.kind === 'sys' && e.payload.t === 'basket_closed') closed.add(e.payload.basketId);
    // An edit re-records a basket under a new id: a close follows it (review fix).
    if ((e.kind === 'accept' || e.kind === 'short') && e.editOf && closed.has(e.editOf)) closed.add(e.id);
  }
  const top = new Map<string, number>();
  if (sequenceOf) {
    for (const b of live) {
      if (b.partOf || !b.pointId || b.basketNo === undefined) continue;
      const seq = sequenceOf(b.pointId);
      top.set(seq, Math.max(top.get(seq) ?? 0, b.basketNo));
    }
  }
  const out = new Map<string, BasketGroup>();
  for (const root of live) {
    // A backfilled short basket is history (E04-S10): closed as entered, never open.
    if (root.kind !== 'short' || root.partOf || !root.pointId || root.basketNo === undefined) continue;
    const parts = [root, ...live.filter((b) => b.partOf === root.id)].sort(compareEvents);
    const partsG = parts.map(basketNetG);
    const netG = partsG.reduce((a, b) => a + b, 0);
    const std = stdNetGOf(root.pileId);
    const movedPast = sequenceOf ? (top.get(sequenceOf(root.pointId)) ?? 0) > root.basketNo : false;
    // No standard weight known for the pile: nothing to fill up to, so never open.
    const status = netG >= std ? 'full' : closed.has(root.id) || root.backfill || movedPast || !Number.isFinite(std) ? 'closed' : 'open';
    out.set(root.id, { rootId: root.id, basketNo: root.basketNo, pointId: root.pointId, parts, partsG, netG, status });
  }
  return out;
}

export interface OpenBasket {
  readonly rootId: string;
  readonly basketNo: number;
  readonly pointId: string;
  readonly haveG: number;
  readonly missingG: number;
  /** Its own basket weight: filling it up weighs this basket, wherever it is now (review fix). */
  readonly tareG: number;
}

const sequence = (pointId: string, mode: NumberingMode, master: MasterState, day: string) => {
  const tapper = mode === 'per-tapper' ? tapperOn(master, pointId, day) : null;
  return tapper ? `t:${tapper}` : `p:${pointId}`;
};

/** The open short basket in `pointId`'s number sequence, if any — the one to fill next. */
export function openBasketIn(
  events: readonly SaleEvent[],
  master: MasterState,
  day: string,
  pointId: string,
  mode: NumberingMode,
  stdNetGOf: (pileId: string) => number,
): OpenBasket | null {
  const seq = sequence(pointId, mode, master, day);
  let best: BasketGroup | null = null;
  for (const g of basketGroups(events, stdNetGOf, (p) => sequence(p, mode, master, day)).values()) {
    if (g.status !== 'open' || sequence(g.pointId, mode, master, day) !== seq) continue;
    if (!best || g.basketNo > best.basketNo) best = g;
  }
  if (!best) return null;
  const root = best.parts[0];
  return {
    rootId: best.rootId,
    basketNo: best.basketNo,
    pointId: best.pointId,
    haveG: best.netG,
    missingG: Math.max(0, stdNetGOf(root.pileId) - best.netG),
    tareG: root.tareG,
  };
}

/**
 * Open baskets to close as they are when weighing moves to `pointId`: those
 * of another tapper (SALE-12). Only when numbering per tapper — per point,
 * each point keeps its own open basket (D-46).
 */
export function tapperChangeClosures(
  events: readonly SaleEvent[],
  master: MasterState,
  day: string,
  pointId: string,
  mode: NumberingMode,
  stdNetGOf: (pileId: string) => number,
): string[] {
  if (mode !== 'per-tapper') return [];
  const here = tapperOn(master, pointId, day);
  // A point with no tapper is nobody's next point: it closes nothing (review fix).
  if (!here) return [];
  return [...basketGroups(events, stdNetGOf, (p) => sequence(p, mode, master, day)).values()]
    .filter((g) => {
      const theirs = tapperOn(master, g.pointId, day);
      return g.status === 'open' && theirs !== null && theirs !== here;
    })
    .map((g) => g.rootId);
}

/** Each pile's standard net as recorded in the sale (its `pile_added` snapshot, MD-7). */
export function stdNetOfLog(events: readonly SaleEvent[]): (pileId: string) => number {
  const std = new Map<string, number>();
  for (const e of events) if (e.kind === 'sys' && e.payload.t === 'pile_added') std.set(e.payload.pileId, e.payload.stdNetG);
  return (pileId) => std.get(pileId) ?? Number.POSITIVE_INFINITY;
}
