/**
 * The sale model on weighing points (E04-S01): baskets are recorded at any
 * point, any farm, in any order, each with a number fixed when it is
 * recorded (SALE-10), and totals roll up by point, tapper, farm and sale.
 *
 * Additive to the pile model (S3/S4): a point-based basket is an ordinary
 * `accept`/`short` event that also carries `pointId` and `basketNo`, so the
 * existing liveness rules (voids, Soft Delete) and `basketNetG` apply as is.
 * All weights are integer grams (NFR-3).
 */

import { tapperOn, type MasterState } from './master';
import { compareEvents } from './order';
import { ZERO_TOTALS, addTotals, basketNetG, liveBaskets } from './totals';
import type { BasketEvent, NumberingMode, PersonId, SaleEvent, Totals } from './types';

export type TapperOf = (pointId: string) => PersonId | null;

/**
 * Which number sequence a basket at `pointId` belongs to: its tapper's
 * (mode a, D-79) or its point's (mode b, D-46). A point with no tapper on the
 * day counts on its own, so it can never borrow someone else's numbers.
 */
function sequenceOf(pointId: string, mode: NumberingMode, tapperOf: TapperOf): string {
  const tapper = mode === 'per-tapper' ? tapperOf(pointId) : null;
  return tapper ? `t:${tapper}` : `p:${pointId}`;
}

/**
 * The number the next basket at `pointId` gets: one above the highest in its
 * sequence. Voided and deleted baskets still hold their number — a number
 * once spoken at the scale is never handed out again.
 */
export function nextBasketNo(events: readonly SaleEvent[], pointId: string, mode: NumberingMode, tapperOf: TapperOf): number {
  const seq = sequenceOf(pointId, mode, tapperOf);
  let max = 0;
  for (const e of events) {
    if ((e.kind !== 'accept' && e.kind !== 'short') || !e.pointId || e.basketNo === undefined) continue;
    if (sequenceOf(e.pointId, mode, tapperOf) === seq) max = Math.max(max, e.basketNo);
  }
  return max + 1;
}

/** The sale's numbering mode: the last `numbering_set` in fold order, else the group default. */
export function saleNumbering(events: readonly SaleEvent[], groupDefault: NumberingMode): NumberingMode {
  let mode = groupDefault;
  for (const e of [...events].sort(compareEvents)) {
    if (e.kind === 'sys' && e.payload.t === 'numbering_set') mode = e.payload.numbering;
  }
  return mode;
}

export interface SaleRollup {
  readonly byPoint: ReadonlyMap<string, Totals>;
  /** Keyed by the point's tapper on the sale day (SALE-4). */
  readonly byTapper: ReadonlyMap<PersonId, Totals>;
  readonly byFarm: ReadonlyMap<string, Totals>;
  /** Baskets at a point with no tapper that day — shown, never dropped (D-63). */
  readonly unassigned: Totals;
  readonly sale: Totals;
}

function one(b: BasketEvent): Totals {
  const netG = basketNetG(b);
  const standard = b.kind === 'accept';
  return {
    baskets: 1,
    standardBaskets: standard ? 1 : 0,
    shortBaskets: standard ? 0 : 1,
    netG,
    standardNetG: standard ? netG : 0,
    shortNetG: standard ? 0 : netG,
  };
}

function bump(map: Map<string, Totals>, key: string, t: Totals) {
  map.set(key, addTotals(map.get(key) ?? ZERO_TOTALS, t));
}

/**
 * Live point-based baskets of the sale, rolled up. Every level is a sum of
 * the same per-basket figures, so they agree to the gram whichever numbering
 * mode the sale used — money is settled on weight, never on numbers.
 */
export function saleRollup(events: readonly SaleEvent[], master: MasterState, saleDay: string): SaleRollup {
  const farmOf = new Map(master.points.map((p) => [p.id, p.propertyId]));
  const byPoint = new Map<string, Totals>();
  const byTapper = new Map<PersonId, Totals>();
  const byFarm = new Map<string, Totals>();
  let unassigned = ZERO_TOTALS;
  let sale = ZERO_TOTALS;
  for (const b of liveBaskets(events)) {
    if (!b.pointId) continue;
    const t = one(b);
    bump(byPoint, b.pointId, t);
    const tapper = tapperOn(master, b.pointId, saleDay);
    if (tapper) bump(byTapper, tapper, t);
    else unassigned = addTotals(unassigned, t);
    const farm = farmOf.get(b.pointId);
    if (farm) bump(byFarm, farm, t);
    sale = addTotals(sale, t);
  }
  return { byPoint, byTapper, byFarm, unassigned, sale };
}
