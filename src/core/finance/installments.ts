/**
 * E06-S09 · instalment plans ("ผ่อนกี่งวด", PRD D-88) — the pure arithmetic.
 *
 * A plan is a number of instalments (`InstallmentPlanSpec` on `debt_plan_set`).
 * Nothing about progress is stored: the instalments paid are counted from the
 * log, and the amount is recomputed at every sale from the debt left (rounded
 * up to whole baht, the last one exact to the satang), so a short or bigger
 * deduction simply moves into the instalments left (Q4). The plan is over when
 * the instalments run out or the debt is paid; what is left is ordinary debt
 * again (Q5). Debt added after the plan needs the owner's choice each time —
 * fold it into the instalments left, or take it in full today (Q3, no default).
 *
 * Architect review 2026-11-06 (story Dev notes): the anchor is `seen`, the
 * highest deviceSeq per device when the plan was written — a sale counts when
 * it is the plan's own sale or its first deduction line was written after
 * that (no clocks, no dates).
 */

import type { DebtAccount, DebtPayment } from './debts';
import { FARM_FUNDS, type FinanceEvent, type FinancePayload, type InstallmentPlanSpec, type Payer } from './types';

export const MIN_INSTALLMENTS = 2;
export const MAX_INSTALLMENTS_LIMIT = 12;
/** The farm setting "ผ่อนหนี้ได้สูงสุด" when it was never set (owner 2026-11-06). */
export const DEFAULT_MAX_INSTALLMENTS = 4;

const clampMax = (max: number) => Math.min(MAX_INSTALLMENTS_LIMIT, Math.max(MIN_INSTALLMENTS, Math.floor(max)));

/** This sale's instalment: what is left ÷ instalments left, up to whole baht, never above what is left; one left = exactly what is left. */
export function installmentAmount(balanceSatang: number, left: number): number | null {
  if (left <= 0 || balanceSatang <= 0) return null;
  if (left === 1) return balanceSatang;
  const per = Math.ceil(balanceSatang / left);
  return Math.min(balanceSatang, Math.ceil(per / 100) * 100);
}

/** Every instalment of a plan started now, as the plan would propose them if each were paid in full. */
export function installmentSplit(balanceSatang: number, count: number): number[] {
  const out: number[] = [];
  let left = balanceSatang;
  for (let k = count; k >= 1; k--) {
    const x = installmentAmount(left, k) ?? 0;
    out.push(x);
    left -= x;
  }
  return out;
}

/**
 * IP-7 · the counts offered: 2 … max (clamped to 2–12), never 1 (that is paying it all), never
 * `currentLeft` — the instalments the running plan has left, this sale included (null: no plan) — at most three — the nearest to the current count (more instalments first on a tie:
 * a re-split usually stretches the plan; owner's example 3 → 2, 4, 5).
 */
export function installmentChoices(currentLeft: number | null, max: number): number[] {
  const current = currentLeft;
  const all: number[] = [];
  for (let k = MIN_INSTALLMENTS; k <= clampMax(max); k++) if (k !== current) all.push(k);
  if (current === null) return all.slice(0, 3);
  return [...all]
    .sort((a, b) => Math.abs(a - current) - Math.abs(b - current) || b - a)
    .slice(0, 3)
    .sort((a, b) => a - b);
}

/** The highest deviceSeq per device in the log: what a plan written now has "seen". */
export function seenSnapshot(events: readonly FinanceEvent[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
    const d = e.actor?.deviceId ?? '';
    if ((out[d] ?? -1) < e.deviceSeq) out[d] = e.deviceSeq;
  }
  return out;
}

/** The plan event: `perSaleSatang` carries the first instalment for app versions that predate instalment plans. */
export function planPayload(i: {
  readonly worker: Payer;
  readonly count: number;
  /** Instalments paid before this re-split / re-base (`count` includes them). */
  readonly earlier?: readonly PaidInstallment[];
  readonly fromSaleId: string | null;
  readonly seen: Readonly<Record<string, number>>;
  readonly owedSatang: number;
  /** The debt left the plan starts from (for the fallback amount). */
  readonly balanceSatang: number;
}): FinancePayload {
  return {
    t: 'debt_plan_set',
    worker: i.worker,
    perSaleSatang: installmentAmount(i.balanceSatang, i.count - (i.earlier?.length ?? 0)),
    installments: { count: i.count, ...(i.earlier?.length ? { earlier: i.earlier } : {}), fromSaleId: i.fromSaleId, seen: i.seen, owedSatang: i.owedSatang },
  };
}

export interface PaidInstallment {
  readonly saleId: string;
  /** The sale day (the deduction lines' date). */
  readonly date: string;
  readonly satang: number;
}

export interface PlanStatus {
  readonly plan: InstallmentPlanSpec;
  /** Sales that paid an instalment, oldest first (the sale being closed left out). */
  readonly paidSales: readonly PaidInstallment[];
  readonly paid: number;
  /** Instalments left, this sale included; 0 or less = the plan is over. */
  readonly left: number;
  /** The farm debt owed now above what it was when the plan was written; > 0 = new debt (Q3). */
  readonly extraSatang: number;
  /** The plan is over: instalments ran out, or the debt it covered is paid (the sale being closed counted as not deducted). */
  readonly done: boolean;
}

const toFarm = (p: Payer | null | undefined) => !p || p.id === FARM_FUNDS;
const counting = (p: DebtPayment) => !p.deleted && p.counts && p.method !== 'outside' && toFarm(p.creditor);

/**
 * IP-3 · the plan's progress. A sale pays one instalment when its live farm deduction lines add up
 * to more than 0 and it is the plan's own sale or none of its lines (voided ones included) was
 * written before the plan (`seen`). `excludeSaleId` = the sale being closed: its own lines never
 * count, so re-confirming it proposes the same instalment.
 */
export function planStatus(i: { readonly account: DebtAccount; readonly events: readonly FinanceEvent[]; readonly excludeSaleId?: string | null }): PlanStatus | null {
  const plan = i.account.installmentPlan;
  if (!plan) return null;
  const creators = new Map<string, FinanceEvent>();
  for (const e of i.events) if (e.baseEventId === null && !creators.has(e.targetId)) creators.set(e.targetId, e);
  const before = (paymentId: string) => {
    const e = creators.get(paymentId);
    if (!e) return false;
    const seen = plan.seen[e.actor?.deviceId ?? ''];
    return seen !== undefined && e.deviceSeq <= seen;
  };
  const bySale = new Map<string, DebtPayment[]>();
  for (const p of i.account.payments) {
    if (!p.saleId || p.saleId === i.excludeSaleId) continue;
    const list = bySale.get(p.saleId) ?? [];
    list.push(p);
    bySale.set(p.saleId, list);
  }
  const kept = new Set((plan.earlier ?? []).map((x) => x.saleId));
  const counted: PaidInstallment[] = [];
  for (const [saleId, all] of bySale) {
    if (kept.has(saleId)) continue;
    const live = all.filter(counting);
    const satang = live.reduce((a, p) => a + p.amountSatang, 0);
    if (satang <= 0) continue;
    if (saleId !== plan.fromSaleId && all.some((p) => before(p.id))) continue;
    const date = live.map((p) => p.date).sort()[0];
    counted.push({ saleId, date, satang });
  }
  counted.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.saleId < b.saleId ? -1 : 1));
  // A re-split / re-base carries what was paid before it, as written (the sale being closed never among them).
  const paidSales = [...(plan.earlier ?? []).filter((x) => x.saleId !== i.excludeSaleId), ...counted];
  const owed = i.account.summary.owed;
  const owedNow = owed.loan + owed.fertilizer + owed.other;
  const left = plan.count - paidSales.length;
  const extraSatang = owedNow - plan.owedSatang;
  // Review 1: as if the sale being closed had deducted nothing, so re-confirming its last instalment is not "over".
  const here = i.excludeSaleId ? i.account.payments.filter((p) => p.saleId === i.excludeSaleId && counting(p)).reduce((a, p) => a + p.amountSatang, 0) : 0;
  const balanceAsIf = i.account.balanceSatang + here;
  // Review 2 (Q5): over once the debt the plan covered is paid — new debt after that is ordinary debt, not a revived plan.
  const planDebtLeft = balanceAsIf - Math.max(0, extraSatang);
  return {
    plan,
    paidSales,
    paid: paidSales.length,
    left,
    extraSatang,
    done: left <= 0 || planDebtLeft <= 0,
  };
}

export type NewDebtChoice = 'fold' | 'full';

/**
 * This sale's instalment for a debt left of `balanceSatang` (as if nothing were deducted at this sale).
 * Over → null (ordinary debt: the caller proposes as without a plan). New debt and no choice → null
 * and `needsChoice` (the sheet gates confirm). "fold": the instalment of everything owed; "full": the
 * instalment of the debt without the new part, plus the new part.
 */
export function installmentProposal(i: { readonly balanceSatang: number; readonly status: PlanStatus; readonly newDebt?: NewDebtChoice }): { satang: number | null; needsChoice: boolean } {
  const { status } = i;
  if (status.done) return { satang: null, needsChoice: false };
  const extra = Math.min(Math.max(0, status.extraSatang), Math.max(0, i.balanceSatang));
  if (extra > 0 && !i.newDebt) return { satang: null, needsChoice: true };
  if (extra > 0 && i.newDebt === 'full') {
    const rest = i.balanceSatang - extra;
    return { satang: (installmentAmount(rest, status.left) ?? 0) + extra, needsChoice: false };
  }
  return { satang: installmentAmount(i.balanceSatang, status.left), needsChoice: false };
}
