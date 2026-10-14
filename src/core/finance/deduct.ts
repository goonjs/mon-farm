/**
 * Deducting worker debt at settlement (E06-S04) — the pure arithmetic.
 *
 * Order (D-60): share → deduct debt → round → cash to pay. The deduction
 * never takes cash below zero: the cap is the smaller of what is owed and
 * the share (D-18), widened by whatever the farm repays the worker at this
 * same sale when the owner chooses to net (D-67). Netting is recorded as two
 * events kept apart — a repayment in the farm's ledger (E11-S03) and a debt
 * payment in the worker's (E06-S03) — that move by the same amount.
 */

import { allocateOldestFirst, type Reimbursement } from './ledger';
import type { FinancePayload, Payer } from './types';

export interface CapInput {
  readonly balanceSatang: number;
  readonly shareSatang: number;
  /** What the farm repays the worker at this sale, if the owner nets. */
  readonly nettingSatang: number;
}

export function deductionCap({ balanceSatang, shareSatang, nettingSatang }: CapInput): number {
  return Math.max(0, Math.min(balanceSatang, shareSatang + nettingSatang));
}

/** The instalment if there is a plan, else the whole balance — never above the cap (FERT-6, D-59). */
export function proposeDeduction(i: CapInput & { readonly planPerSaleSatang: number | null }): number {
  const cap = deductionCap(i);
  return Math.min(i.planPerSaleSatang ?? i.balanceSatang, cap);
}

export type RoundingMode = 'worker' | 'owner' | 'none';

/** Round the worker's cash to whole baht in someone's favour, or not at all (SET-5). The adjustment is its own line. */
export function roundCash(cashSatang: number, mode: RoundingMode): { cashSatang: number; adjustSatang: number } {
  const frac = ((cashSatang % 100) + 100) % 100;
  if (mode === 'none' || frac === 0) return { cashSatang, adjustSatang: 0 };
  const adjust = mode === 'worker' ? 100 - frac : -frac;
  return { cashSatang: cashSatang + adjust, adjustSatang: adjust };
}

/** Cash handed to the worker: share + netting − deduction ± rounding, floored at zero. */
export function workerCash(i: { shareSatang: number; deductionSatang: number; nettingSatang: number; adjustSatang: number }): number {
  return Math.max(0, i.shareSatang + i.nettingSatang - i.deductionSatang + i.adjustSatang);
}

const NOTES = [100000, 50000, 10000, 5000, 2000, 1000, 500, 200, 100];

/** How a buyer pays an amount: largest notes and coins first; leftover satang as one item. */
export function cashNotes(satang: number): number[] {
  const out: number[] = [];
  let left = satang;
  for (const n of NOTES) {
    while (left >= n) {
      out.push(n);
      left -= n;
    }
  }
  if (left > 0) out.push(left);
  return out;
}

/**
 * D-71 route 1: the notes to lift out of the worker's cash pile (paid largest
 * first) to take exactly `take`, or null when a note must be broken.
 */
export function pickNotes(pileSatang: number, takeSatang: number): number[] | null {
  if (takeSatang <= 0) return [];
  if (takeSatang > pileSatang) return null;
  // Subset sum over the notes in the pile — a handful of items, so a map of reachable totals is enough.
  let reach = new Map<number, number[]>([[0, []]]);
  for (const n of cashNotes(pileSatang)) {
    const next = new Map(reach);
    for (const [r, used] of reach) if (r + n <= takeSatang && !next.has(r + n)) next.set(r + n, [...used, n]);
    reach = next;
    const hit = reach.get(takeSatang);
    if (hit) return hit;
  }
  return null;
}

/** D-71 route 1: can `take` be lifted out of the worker's cash pile as it is, without breaking a note? */
export function needsChange(pileSatang: number, takeSatang: number): boolean {
  if (takeSatang <= 0 || takeSatang === pileSatang) return false;
  return pickNotes(pileSatang, takeSatang) === null;
}

/** Every pile on the reconciliation page must add up to the sale total, to the satang (D-72). */
export function pilesCheck(piles: readonly { readonly satang: number }[], saleTotalSatang: number) {
  const sumSatang = piles.reduce((s, p) => s + p.satang, 0);
  return { sumSatang, diffSatang: sumSatang - saleTotalSatang, ok: sumSatang === saleTotalSatang };
}

/** D-61: after a sale edit, the deductions may exceed what the share (+ netting) now allows. */
export function overDeducted(deductionSatang: number, shareSatang: number, nettingSatang: number): boolean {
  return deductionSatang > shareSatang + nettingSatang;
}

export type DeductProblem = 'net-range' | 'total-range' | 'below-netting' | 'nothing';

/**
 * The deduct sheet (mockup page 17a, owner 2026-10-14). The owner enters the
 * whole debt deducted at this sale (หักหนี้) and, apart, what the farm repays
 * the worker by netting (+ line). Only the difference is collected by the
 * chosen route; cash = share − หักหนี้ + netting. Every amount is "as if
 * nothing were deducted at this sale yet": the sheet replaces this sale's lines.
 */
export function deductSheet(i: {
  readonly balanceSatang: number;
  readonly shareSatang: number;
  readonly owedBackSatang: number;
  readonly planPerSaleSatang: number | null;
  /** What the owner typed; null = untouched, follow the proposal. An empty box is 0 (review F8). */
  readonly totalSatang: number | null;
  readonly nettingSatang: number;
  /** This sale already has lines: saving 0 removes them. */
  readonly editing?: boolean;
}) {
  const balance = Math.max(0, i.balanceSatang);
  const share = Math.max(0, i.shareSatang);
  const netCapSatang = Math.max(0, Math.min(i.owedBackSatang, balance));
  const netOk = i.nettingSatang >= 0 && i.nettingSatang <= netCapSatang;
  const net = netOk ? i.nettingSatang : 0;
  const capSatang = deductionCap({ balanceSatang: balance, shareSatang: share, nettingSatang: net });
  const proposedSatang = Math.max(net, proposeDeduction({ balanceSatang: balance, shareSatang: share, nettingSatang: net, planPerSaleSatang: i.planPerSaleSatang }));
  const totalSatang = i.totalSatang ?? proposedSatang;
  let problem: DeductProblem | null = null;
  if (!netOk) problem = 'net-range';
  else if (totalSatang < 0 || totalSatang > capSatang) problem = 'total-range';
  else if (totalSatang < net) problem = 'below-netting';
  else if (totalSatang === 0 && !i.editing) problem = 'nothing';
  const routeSatang = Math.max(0, totalSatang - net);
  return {
    netCapSatang,
    capSatang,
    proposedSatang,
    totalSatang,
    nettingSatang: net,
    /** Collected by the chosen route (D-71): the worker's real repayment in money. */
    routeSatang,
    cashSatang: Math.max(0, share - routeSatang),
    debtLeftSatang: Math.max(0, balance - totalSatang),
    problem,
  };
}

export type NettingPlan =
  | { readonly ok: true; readonly repayment: FinancePayload; readonly debtPayment: FinancePayload }
  | { readonly ok: false; readonly maxSatang: number };

/**
 * Netting at a sale: the farm repays part (or all) of what it owes the
 * worker, oldest first, and that same amount comes off the worker's debt.
 * Both name the sale, so cancelling/deleting it voids both (D-67).
 */
export function nettingPayloads(i: {
  worker: Payer;
  farm: Payer;
  owed: readonly Reimbursement[];
  amountSatang: number;
  saleId: string;
  date: string;
  /** The id the repayment will be written under — the debt payment points at it. */
  repaymentId: string;
}): NettingPlan {
  const mine = i.owed.filter((r) => r.to.id === i.worker.id);
  const plan = allocateOldestFirst(mine, i.amountSatang);
  if (!plan.ok) return { ok: false, maxSatang: plan.maxSatang };
  return {
    ok: true,
    repayment: {
      t: 'repayment_recorded',
      fields: { from: i.farm, to: i.worker, amountSatang: i.amountSatang, date: i.date, note: '', allocations: plan.allocations, saleId: i.saleId },
    },
    debtPayment: {
      t: 'debt_payment_recorded',
      fields: { worker: i.worker, creditor: i.farm, amountSatang: i.amountSatang, date: i.date, note: '', method: 'netting', saleId: i.saleId, repaymentId: i.repaymentId },
    },
  };
}
