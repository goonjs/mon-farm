/**
 * The zero/tare check by mode, and the scale's skew (E04-S03, SALE-6, D-75,
 * D-76). Pure folds of the sale log, like everything in core.
 */

import { compareEvents } from './order';
import type { PileId, SaleEvent, SaleState, ZeroCheckMode } from './types';

/**
 * The skew in force: the last `skew_accepted`, cleared by any later passing
 * zero check (D-75). One scale per sale, so it is sale-wide, not per point.
 */
export function saleSkewG(events: readonly SaleEvent[]): number {
  let skew = 0;
  for (const e of [...events].sort(compareEvents)) {
    if (e.kind !== 'sys') continue;
    if (e.payload.t === 'skew_accepted') skew = e.payload.skewG;
    if (e.payload.t === 'zero_check' && e.payload.ok) skew = 0;
  }
  return skew;
}

/** What the scale should read for a full basket: net + basket + skew (D-75). */
export function expectedReadingG(stdNetG: number, tareG: number, skewG: number): number {
  return stdNetG + tareG + skewG;
}

/** Was a skew ever accepted in this sale? Then every point move checks again (D-76). */
function hadSkew(events: readonly SaleEvent[]): boolean {
  return events.some((e) => e.kind === 'sys' && e.payload.t === 'skew_accepted');
}

/**
 * Must the operator check zero and confirm tare at `pileId` before its
 * first basket? "every" — yes; "first-per-farm" — only if no other point of
 * the same farm has passed the gate yet in this sale; "skip" — no. A sale
 * that ever accepted a skew asks at every point regardless (D-76).
 */
export function gateNeeded(state: SaleState, events: readonly SaleEvent[], pileId: PileId, mode: ZeroCheckMode): boolean {
  if (hadSkew(events)) return true;
  if (mode === 'every') return true;
  if (mode === 'skip') return false;
  const pile = state.piles.find((p) => p.id === pileId);
  return !state.piles.some((p) => p.id !== pileId && p.zoneId === pile?.zoneId && p.status !== 'not-started');
}
