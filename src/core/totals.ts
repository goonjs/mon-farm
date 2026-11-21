/**
 * Rollups (FR-6). Every total in the app comes from here.
 *
 * `pileTotals` is the same fold that produces the closing figure spoken at pile
 * close, the running weight in the operator strip, and the input to `settle()`.
 * One implementation means one place to be wrong — and, more importantly, means
 * the settlement cannot disagree with the number the buyer already heard.
 */

import type {
  BasketEvent,
  PileId,
  SaleEvent,
  SaleState,
  Totals,
  ZoneId,
} from './types';
import { basketGroups, stdNetOfLog } from './bridge';
import { basketNetG, liveBaskets } from './live';
import { ZERO_TOTALS } from './types';

export { basketNetG, liveBaskets };

/** The most recent live basket in a pile — what `undo-last` targets. */
export function lastLiveBasket(
  events: readonly SaleEvent[],
  pileId: PileId,
): BasketEvent | null {
  const live = liveBaskets(events, pileId);
  return live.length ? live[live.length - 1] : null;
}

/** Whether a live basket event counts on the full side. */
export type FullOf = (b: BasketEvent) => boolean;

/**
 * Full or short, read the way the basket list reads it (E04-S25): a short
 * basket topped up until full is one full basket, and every part of it counts
 * on the full side; one that stays short keeps all its parts on the short
 * side. A basket outside any bridge group goes by its own kind, as before.
 */
export function fullnessOf(events: readonly SaleEvent[]): FullOf {
  const groups = basketGroups(events, stdNetOfLog(events));
  return (b) => {
    const g = groups.get(b.partOf ?? b.id);
    return g ? g.status === 'full' : b.kind === 'accept';
  };
}

/**
 * One basket event's share of any total. A later part of a bridged basket
 * (E04-S06) adds its weight where it was weighed, never another basket: the
 * basket is counted once, at its first part (E04-S25).
 */
export function basketTotals(b: BasketEvent, full: boolean): Totals {
  // Through basketNetG so an accepted skew is taken off here too —
  // settlement must never disagree with the recorder (E04 skew).
  const netG = basketNetG(b);
  const n = b.partOf === undefined ? 1 : 0;
  return {
    baskets: n,
    standardBaskets: full ? n : 0,
    shortBaskets: full ? 0 : n,
    netG,
    standardNetG: full ? netG : 0,
    shortNetG: full ? 0 : netG,
  };
}

function tally(baskets: readonly BasketEvent[], fullOf: FullOf): Totals {
  return baskets.reduce((t, b) => addTotals(t, basketTotals(b, fullOf(b))), ZERO_TOTALS);
}

export function pileTotals(events: readonly SaleEvent[], pileId: PileId): Totals {
  return tally(liveBaskets(events, pileId), fullnessOf(events));
}

export function zoneTotals(
  events: readonly SaleEvent[],
  state: SaleState,
  zoneId: ZoneId,
): Totals {
  const pileIds = new Set(state.piles.filter((p) => p.zoneId === zoneId).map((p) => p.id));
  return tally(liveBaskets(events).filter((b) => pileIds.has(b.pileId)), fullnessOf(events));
}

export function saleTotals(events: readonly SaleEvent[]): Totals {
  return tally(liveBaskets(events), fullnessOf(events));
}

/** FR-6.3 — an ad-hoc total over any chosen set of piles. */
export function subsetTotals(
  events: readonly SaleEvent[],
  pileIds: readonly PileId[],
): Totals {
  const wanted = new Set(pileIds);
  return tally(liveBaskets(events).filter((b) => wanted.has(b.pileId)), fullnessOf(events));
}

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    baskets: a.baskets + b.baskets,
    standardBaskets: a.standardBaskets + b.standardBaskets,
    shortBaskets: a.shortBaskets + b.shortBaskets,
    netG: a.netG + b.netG,
    standardNetG: a.standardNetG + b.standardNetG,
    shortNetG: a.shortNetG + b.shortNetG,
  };
}

export { ZERO_TOTALS };
