/**
 * Rounding the cash handed to each worker (E05-S02, SET-5, D-60): asked per
 * sale, AFTER debt deductions, in the worker's favour, the owner's, or not
 * at all. Each worker's adjustment is its own line, and the owner absorbs
 * the opposite, so owner + workers + adjustments still equal the sale to the
 * satang (NFR-3). The choice lives in the finance log, keyed by sale; this
 * device's latest choice is the default for the next sale.
 */

import { roundCash, type RoundingMode } from './deduct';
import { headOf } from './ledger';
import type { FinanceEvent } from './types';

export interface RoundingChoice {
  readonly mode: RoundingMode;
  /** False until this sale has its own choice — the screen must ask (when there is a fraction). */
  readonly asked: boolean;
  /** The head an edit to this sale's choice builds on. */
  readonly head: string | null;
}

export function roundingFor(events: readonly FinanceEvent[], saleId: string, deviceId: string): RoundingChoice {
  const own = events.filter((e) => e.targetId === `sale-rounding-${saleId}`);
  if (own.length) {
    const head = headOf(own);
    const p = own.find((e) => e.id === head)?.payload;
    if (p?.t === 'sale_rounding_set') return { mode: p.mode, asked: true, head };
  }
  let last: FinanceEvent | null = null;
  for (const e of events) {
    if (e.payload.t === 'sale_rounding_set' && e.actor.deviceId === deviceId && (!last || e.deviceSeq > last.deviceSeq)) last = e;
  }
  const mode = last?.payload.t === 'sale_rounding_set' ? last.payload.mode : 'none';
  return { mode, asked: false, head: null };
}

export interface RoundedWorker {
  readonly id: string;
  readonly cashSatang: number;
  readonly adjustSatang: number;
}

export function roundSettlement(
  workers: readonly { readonly id: string; readonly cashBeforeSatang: number }[],
  mode: RoundingMode,
  ownerShareSatang: number,
): { workers: RoundedWorker[]; ownerSatang: number; needsAsking: boolean } {
  const out = workers.map((w) => ({ id: w.id, ...roundCash(w.cashBeforeSatang, mode) }));
  const adjust = out.reduce((s, w) => s + w.adjustSatang, 0);
  return {
    workers: out,
    ownerSatang: ownerShareSatang - adjust,
    needsAsking: workers.some((w) => w.cashBeforeSatang % 100 !== 0),
  };
}
