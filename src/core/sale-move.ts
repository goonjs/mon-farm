/**
 * Moving the weighing to a point (v2 sale flow, E04-S05/S06, mockup pages
 * 6, 8c, 12): what to ask, what closes on its own, and whether the empty
 * scale is checked first. Pure folds of the sale log and master data.
 */

import { openBasketIn, stdNetOfLog, tapperChangeClosures, type OpenBasket } from './bridge';
import type { BasketPair, MasterState, SaleSettings } from './master';
import { pointGateNeeded } from './scale-check';
import type { NumberingMode, SaleEvent, SaleState, ZeroCheckMode } from './types';

export interface MovePlan {
  /** The same tapper's open short basket weighed elsewhere: ask fill / part / next (D-57). */
  readonly ask: OpenBasket | null;
  /** Another tapper's open baskets: closed short without asking (SALE-12). */
  readonly closes: readonly string[];
  /** Check the empty scale before weighing here (SALE-6, D-76). */
  readonly gate: boolean;
}

export function planMove(
  events: readonly SaleEvent[],
  state: SaleState,
  master: MasterState,
  day: string,
  pointId: string,
  mode: NumberingMode,
  zeroCheck: ZeroCheckMode,
): MovePlan {
  const farmId = master.points.find((p) => p.id === pointId)?.propertyId ?? '';
  const std = stdNetOfLog(events);
  const open = mode === 'per-tapper' ? openBasketIn(events, master, day, pointId, mode, std) : null;
  return {
    ask: open && open.pointId !== pointId ? open : null,
    closes: tapperChangeClosures(events, master, day, pointId, mode, std),
    gate: pointGateNeeded(state, events, pointId, farmId, zeroCheck),
  };
}

/**
 * The net + basket pair a point new to the sale is weighed with: the one
 * picked at the start (`pairId`), else the sale's last point's, else the
 * group default (MD-7).
 */
export function pairForNewPoint(events: readonly SaleEvent[], settings: SaleSettings, pairId?: string | null): BasketPair {
  const picked = pairId ? settings.pairs.find((p) => p.pairId === pairId) : undefined;
  if (picked) return picked;
  let last: BasketPair | null = null;
  for (const e of events) if (e.kind === 'sys' && e.payload.t === 'pile_added') last = { pairId: '', netG: e.payload.stdNetG, basketG: e.payload.tareG };
  return last ?? settings.pairs.find((p) => p.isDefault) ?? settings.pairs[0];
}
