/**
 * Rollups (FR-6). Every total in the app comes from here.
 *
 * `pileTotals` is the same fold that produces the closing figure spoken at pile
 * close, the running weight in the operator strip, and the input to `settle()`.
 * One implementation means one place to be wrong — and, more importantly, means
 * the settlement cannot disagree with the number the buyer already heard.
 */

import { removedPileIds } from './project';
import type {
  BasketEvent,
  PileId,
  SaleEvent,
  SaleState,
  Totals,
  ZoneId,
} from './types';
import { ZERO_TOTALS } from './types';

/**
 * The baskets that still count.
 *
 * A basket is live unless some `correction` event targets its sequence number.
 * Corrections never mutate their target, so "was it voided?" is always a
 * question about the log, never about a flag someone remembered to set.
 */
export function liveBaskets(
  events: readonly SaleEvent[],
  pileId?: PileId,
): readonly BasketEvent[] {
  const voided = new Set<number>();
  for (const e of events) {
    if (e.kind === 'correction') voided.add(e.targetSeq);
  }

  const out: BasketEvent[] = [];
  for (const e of events) {
    if (e.kind !== 'accept' && e.kind !== 'short') continue;
    if (voided.has(e.seq)) continue;
    if (pileId !== undefined && e.pileId !== pileId) continue;
    out.push(e);
  }
  return out.sort((a, b) => a.seq - b.seq);
}

/** The most recent live basket in a pile — what `undo-last` targets. */
export function lastLiveBasket(
  events: readonly SaleEvent[],
  pileId: PileId,
): BasketEvent | null {
  const live = liveBaskets(events, pileId);
  return live.length ? live[live.length - 1] : null;
}

/** A short basket's net is derived, never stored: reading minus tare. */
export function basketNetG(b: BasketEvent): number {
  return b.kind === 'accept' ? b.netG : b.readingG - b.tareG;
}

function tally(baskets: readonly BasketEvent[]): Totals {
  let standardBaskets = 0;
  let shortBaskets = 0;
  let standardNetG = 0;
  let shortNetG = 0;

  for (const b of baskets) {
    if (b.kind === 'accept') {
      standardBaskets++;
      standardNetG += b.netG;
    } else {
      shortBaskets++;
      shortNetG += b.readingG - b.tareG;
    }
  }

  return {
    baskets: standardBaskets + shortBaskets,
    standardBaskets,
    shortBaskets,
    netG: standardNetG + shortNetG,
    standardNetG,
    shortNetG,
  };
}

export function pileTotals(events: readonly SaleEvent[], pileId: PileId): Totals {
  return tally(liveBaskets(events, pileId));
}

/**
 * The baskets that count towards a rollup: live, and in a pile that has not
 * been retired (S26).
 *
 * Deliberately NOT folded into `liveBaskets`. That function answers "was this
 * basket voided", which is a question about the basket, and the log tab still
 * has to show a removed pile's baskets as the real, unvoided events they are.
 * Removal is an exclusion applied one level up, at the rollup — which is
 * exactly what makes it possible to drop a whole pile out of the money
 * without touching a single basket event.
 *
 * Applied here, once, rather than by each caller: `saleTotals` and
 * `subsetTotals` take a log and no state, so a caller that had to remember to
 * filter would eventually forget, and forgetting means paying for rubber
 * somebody already said was not being sold.
 */
function countingBaskets(events: readonly SaleEvent[]): readonly BasketEvent[] {
  const removed = removedPileIds(events);
  if (!removed.size) return liveBaskets(events);
  return liveBaskets(events).filter((b) => !removed.has(b.pileId));
}

export function zoneTotals(
  events: readonly SaleEvent[],
  state: SaleState,
  zoneId: ZoneId,
): Totals {
  const pileIds = new Set(state.piles.filter((p) => p.zoneId === zoneId).map((p) => p.id));
  return tally(countingBaskets(events).filter((b) => pileIds.has(b.pileId)));
}

export function saleTotals(events: readonly SaleEvent[]): Totals {
  return tally(countingBaskets(events));
}

/** FR-6.3 — an ad-hoc total over any chosen set of piles. */
export function subsetTotals(
  events: readonly SaleEvent[],
  pileIds: readonly PileId[],
): Totals {
  const wanted = new Set(pileIds);
  return tally(countingBaskets(events).filter((b) => wanted.has(b.pileId)));
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
