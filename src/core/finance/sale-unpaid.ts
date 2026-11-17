/**
 * E15-S06 · how many piles of money (กองเงิน) of one sale are not ticked paid yet, for the home's tiles and the
 * row of a sale carried over a day. The piles are the payment page's rows: each tapper's cash, each tapper's
 * cash repayment, and the owner's transfer. The figures follow `useSaleMoney` (settlement → debt deductions →
 * rounding) on the recorded events only; the ticks come from `paymentStatus`. A sale that cannot be settled
 * (no price, a mix of baskets) has no pile waiting.
 */

import { isPointSale, settlePoints } from '../point-settle';
import { saleDay } from '../sale-list';
import { settle, SettlementUnavailable, type Settlement } from '../settle';
import type { MasterState } from '../master';
import type { SaleEvent, SaleState } from '../types';
import { projectDebts } from './debts';
import { workerCash } from './deduct';
import { OWNER_PAYEE, paymentStatus } from './payments';
import { roundingFor, roundSettlement } from './rounding';
import type { FinanceEvent } from './types';

/**
 * Sales before this day are not counted as owing money: payments were not ticked on the payment page before it, so
 * their piles would read "not paid" for ever (the same cut-off as the repayments on the home, `pendingRepayLines`).
 */
export const UNPAID_COUNTED_FROM = '2026-11-01';

export interface UnpaidInput {
  readonly events: readonly SaleEvent[];
  readonly state: SaleState;
  /** The finance log: debts, rounding choices and payment ticks. */
  readonly fin: readonly FinanceEvent[];
  /** Needed to settle a sale weighed on points; null otherwise. */
  readonly master: MasterState | null;
  readonly deviceId: string;
  /** Whether a sale still counts (not deleted), for the debts' payments. */
  readonly counts: (saleId: string) => boolean;
  /** Wall clock, for the sale's day when none was picked; defaults to now. */
  readonly now?: number;
}

function settlementOf({ events, state, master, now }: UnpaidInput): Settlement | null {
  try {
    if (isPointSale(events)) return master ? settlePoints(events, state, master, saleDay(state.startedTs, now ?? Date.now(), state.day)) : null;
    return settle(events, state);
  } catch (err) {
    if (err instanceof SettlementUnavailable) return null;
    throw err;
  }
}

export function unpaidPiles(input: UnpaidInput): number {
  const { state, fin, deviceId, counts } = input;
  const settlement = settlementOf(input);
  if (!settlement) return 0;
  const saleId = state.id;
  const debts = projectDebts(fin, counts);
  const here = (id: string) => (debts.get(id)?.payments ?? []).filter((p) => p.saleId === saleId && !p.deleted && p.counts);

  const workers = settlement.perWorker.map((w) => {
    const lines = here(w.personId);
    const deducted = lines.filter((p) => p.method !== 'netting').reduce((s, p) => s + p.amountSatang, 0);
    const netted = lines.filter((p) => p.method === 'netting').reduce((s, p) => s + p.amountSatang, 0);
    return { id: w.personId, cashBeforeSatang: workerCash({ shareSatang: Math.max(0, w.workerSatang), deductionSatang: deducted + netted, nettingSatang: netted, adjustSatang: 0 }) };
  });
  const choice = roundingFor(fin, saleId, deviceId);
  const rounded = roundSettlement(workers, choice.mode, settlement.ownerSatang);

  let transferIn = 0;
  for (const a of debts.values()) for (const p of a.payments) if (p.saleId === saleId && !p.deleted && p.counts && p.method === 'transfer-with-owner') transferIn += p.amountSatang;

  const piles: { id: string; satang: number }[] = [];
  rounded.workers.forEach((r) => {
    if (r.cashSatang > 0) piles.push({ id: r.id, satang: r.cashSatang });
    const repaid = here(r.id).filter((p) => p.method === 'cash-from-share' || p.method === 'buyer-split').reduce((s, p) => s + p.amountSatang, 0);
    if (repaid > 0) piles.push({ id: `debt-cash-${r.id}`, satang: repaid });
  });
  const ownerTransfer = rounded.ownerSatang + transferIn;
  if (ownerTransfer > 0) piles.push({ id: OWNER_PAYEE, satang: ownerTransfer });

  return piles.filter((p) => !paymentStatus(fin, saleId, p.id, p.satang).done).length;
}
