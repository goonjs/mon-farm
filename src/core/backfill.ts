/**
 * A point's weighing entered afterwards as a total (E04-S10, SALE-18, D-49):
 * N full baskets + an optional short one in kg, numbered on from the last
 * basket of the sale's number sequence (owner 2026-10-03: append, never
 * insert). They are ordinary baskets in every total, labelled
 * "บันทึกย้อนหลัง"; the short one is history, so it is never left open.
 */

import { tapperOn, type MasterState } from './master';
import { nextBasketNo } from './sale-points';
import type { NumberingMode, SaleEvent } from './types';

export interface BackfillPlan {
  /** The sequence's last number before these — "ต่อจากเข่งล่าสุด (27)". */
  readonly lastNo: number;
  readonly fullFrom: number;
  readonly fullTo: number;
  readonly fullG: number;
  readonly shortNo: number | null;
  readonly shortG: number | null;
  readonly baskets: number;
  readonly totalG: number;
}

export function backfillPlan(
  events: readonly SaleEvent[],
  master: MasterState,
  day: string,
  pointId: string,
  mode: NumberingMode,
  pile: { stdNetG: number; tareG: number },
  fullCount: number,
  shortG: number | null,
): BackfillPlan | null {
  if (fullCount < 0 || !Number.isInteger(fullCount)) return null;
  if (fullCount === 0 && !shortG) return null;
  const first = nextBasketNo(events, pointId, mode, (id) => tapperOn(master, id, day));
  const fullG = fullCount * pile.stdNetG;
  const hasShort = !!shortG && shortG > 0;
  return {
    lastNo: first - 1,
    fullFrom: first,
    fullTo: first + fullCount - 1,
    fullG,
    shortNo: hasShort ? first + fullCount : null,
    shortG: hasShort ? shortG : null,
    baskets: fullCount + (hasShort ? 1 : 0),
    totalG: fullG + (hasShort ? shortG : 0),
  };
}

export type BackfillEvent =
  | { kind: 'accept'; pileId: string; pointId: string; basketNo: number; input: 'backfill'; netG: number; tareG: number }
  | { kind: 'short'; pileId: string; pointId: string; basketNo: number; readingG: number; tareG: number; backfill: true };

/** The baskets to append for a plan, at `pointId` (the point is the pile). */
export function backfillEvents(plan: BackfillPlan, pointId: string, pile: { stdNetG: number; tareG: number }): BackfillEvent[] {
  const out: BackfillEvent[] = [];
  for (let n = plan.fullFrom; n <= plan.fullTo; n++) {
    out.push({ kind: 'accept', pileId: pointId, pointId, basketNo: n, input: 'backfill', netG: pile.stdNetG, tareG: pile.tareG });
  }
  if (plan.shortNo !== null && plan.shortG !== null) {
    // Entered as net rubber; stored as a reading like any short basket (reading − basket = net).
    out.push({ kind: 'short', pileId: pointId, pointId, basketNo: plan.shortNo, readingG: plan.shortG + pile.tareG, tareG: pile.tareG, backfill: true });
  }
  return out;
}
