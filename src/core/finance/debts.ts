/**
 * Worker debt ledger (E06-S03): one balance per worker for what they owe the
 * farm, the debts they owe other people shown beside it (never deductible —
 * D-69), an optional per-sale instalment plan, and the D-72 reconciliation:
 *
 *   Σ debts by kind − Σ deducted at settlement by method − Σ paid outside
 *     = balance, to the satang.
 *
 * Everything is recomputed from the log; voids and edits are events, so the
 * history is never rewritten.
 */

import { fertilizerSplit, foldRecordPublic, headOf, projectFinance } from './ledger';
import { shareDebts } from './share';
import {
  FARM_FUNDS,
  type DebtFields,
  type DebtKind,
  type DebtPaymentFields,
  type DebtPaymentMethod,
  type FinanceEvent,
  type Payer,
  type RepaymentFields,
} from './types';

export { fertilizerSplit };

export type DebtProblem = 'amount-required' | 'date-required' | 'note-required';

/**
 * A fertilizer debt is judged on the bill, not the worker's share: at 0% the
 * owner carries it all and the worker's share is legitimately zero (review #9).
 */
export function checkDebt(
  f: Pick<DebtFields, 'kind' | 'amountSatang' | 'date' | 'note'> & { readonly fertilizerTotalSatang?: number },
): DebtProblem[] {
  const out: DebtProblem[] = [];
  const judged = f.kind === 'fertilizer' && f.fertilizerTotalSatang !== undefined ? f.fertilizerTotalSatang : f.amountSatang;
  if (!Number.isSafeInteger(judged) || judged <= 0 || f.amountSatang < 0) out.push('amount-required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) out.push('date-required');
  if (f.kind === 'other' && !f.note.trim()) out.push('note-required');
  return out;
}

export interface Debt extends DebtFields {
  readonly id: string;
  readonly deleted: boolean;
  readonly headEventId: string;
}

export interface DebtPayment extends DebtPaymentFields {
  readonly id: string;
  readonly deleted: boolean;
  readonly headEventId: string;
  /** False when its sale is cancelled or deleted — then it does not count. */
  readonly counts: boolean;
}

export interface HistoryLine {
  readonly id: string;
  /** Debt kind, or what reduced it. */
  readonly type: DebtKind | 'deduction' | 'payment';
  /** + adds to what the worker owes, − reduces it. */
  readonly signedSatang: number;
  readonly date: string;
  readonly saleId: string | null;
  readonly deleted: boolean;
  /** Whom it is owed to / paid to — farm funds or an outside lender. */
  readonly creditor: Payer;
}

export interface OtherLender {
  readonly lender: Payer;
  readonly owedSatang: number;
  readonly paidSatang: number;
  readonly balanceSatang: number;
}

export interface DebtSummary {
  readonly owed: Record<DebtKind, number>;
  readonly deducted: Record<Exclude<DebtPaymentMethod, 'outside'>, number>;
  readonly outside: number;
  readonly balanceSatang: number;
}

export interface DebtAccount {
  readonly worker: Payer;
  /** What the worker owes the farm — the only deductible balance. Negative = farm owes the worker (F10). */
  readonly balanceSatang: number;
  readonly overpaid: boolean;
  readonly summary: DebtSummary;
  readonly others: readonly OtherLender[];
  readonly planPerSaleSatang: number | null;
  /** Newest first. */
  readonly history: readonly HistoryLine[];
  readonly debts: readonly Debt[];
  readonly payments: readonly DebtPayment[];
}

const toFarm = (p: Payer | null) => !p || p.id === FARM_FUNDS;

/**
 * Per worker id. `saleCounts(saleId)` says whether a sale is still live; a
 * deduction at a cancelled/deleted sale does not reduce the balance (and
 * counts again if it is restored). Defaults to "every sale counts".
 */
export function projectDebts(
  events: readonly FinanceEvent[],
  saleCounts: (saleId: string) => boolean = () => true,
): Map<string, DebtAccount> {
  const debts: Debt[] = [];
  const payments: DebtPayment[] = [];
  const plans = new Map<string, number | null>();

  const byTarget = new Map<string, FinanceEvent[]>();
  for (const e of events) {
    const list = byTarget.get(e.targetId) ?? [];
    list.push(e);
    byTarget.set(e.targetId, list);
  }

  for (const [id, evs] of byTarget) {
    const first = evs.find((e) => e.baseEventId === null);
    if (!first) continue;
    const t = first.payload.t;
    if (t === 'debt_added') {
      const f = foldRecordPublic(evs, (c) => ({ ...(c.payload as { fields: DebtFields }).fields, deleted: false }), ['amountSatang', 'fertilizer', 'worker', 'lender']);
      if (f) debts.push({ ...f.state, id, headEventId: f.head });
    } else if (t === 'debt_payment_recorded') {
      const f = foldRecordPublic(evs, (c) => ({ ...(c.payload as { fields: DebtPaymentFields }).fields, deleted: false }), ['amountSatang', 'creditor', 'worker']);
      if (f) {
        // A netting payment counts only while the repayment it was written with is live: the two are
        // separate events, so a write that stopped between them (or an undo that did) cancels out.
        let paired = true;
        if (f.state.method === 'netting' && f.state.repaymentId) {
          const rev = byTarget.get(f.state.repaymentId);
          const rf = rev && foldRecordPublic(rev, (c) => ({ ...(c.payload as { fields: RepaymentFields }).fields, deleted: false }), ['amountSatang', 'allocations', 'from', 'to']);
          paired = !!rf && !rf.state.deleted;
        }
        payments.push({ ...f.state, id, headEventId: f.head, counts: paired && (!f.state.saleId || saleCounts(f.state.saleId)) });
      }
    } else if (t === 'debt_plan_set') {
      // Plans carry no patch: the current head of the chain is the plan.
      const head = headOf(evs);
      const p = evs.find((e) => e.id === head)?.payload;
      if (p?.t === 'debt_plan_set') plans.set(p.worker.id, p.perSaleSatang);
    }
  }

  // Tappers' parts of shared expenses (E11-S10) — projected from the expense, never stored.
  debts.push(...shareDebts(projectFinance(events).expenses));

  const workers = new Map<string, Payer>();
  for (const d of debts) workers.set(d.worker.id, d.worker);
  for (const p of payments) workers.set(p.worker.id, p.worker);

  const out = new Map<string, DebtAccount>();
  for (const [wid, worker] of workers) {
    const ds = debts.filter((d) => d.worker.id === wid);
    const ps = payments.filter((p) => p.worker.id === wid);
    const liveD = ds.filter((d) => !d.deleted);
    const liveP = ps.filter((p) => !p.deleted && p.counts);

    const owed: Record<DebtKind, number> = { loan: 0, fertilizer: 0, other: 0 };
    for (const d of liveD) if (d.kind !== 'loan' || toFarm(d.lender)) owed[d.kind] += d.amountSatang;
    const deducted = { 'cash-from-share': 0, 'buyer-split': 0, 'transfer-with-owner': 0, netting: 0 };
    let outside = 0;
    for (const p of liveP) {
      if (!toFarm(p.creditor)) continue;
      if (p.method === 'outside') outside += p.amountSatang;
      else deducted[p.method] += p.amountSatang;
    }
    const balance = owed.loan + owed.fertilizer + owed.other - Object.values(deducted).reduce((a, b) => a + b, 0) - outside;

    const lenders = new Map<string, OtherLender>();
    const lender = (p: Payer) => lenders.get(p.id) ?? { lender: p, owedSatang: 0, paidSatang: 0, balanceSatang: 0 };
    for (const d of liveD) {
      if (d.kind !== 'loan' || toFarm(d.lender)) continue;
      const l = lender(d.lender!);
      lenders.set(l.lender.id, { ...l, owedSatang: l.owedSatang + d.amountSatang });
    }
    for (const p of liveP) {
      if (toFarm(p.creditor)) continue;
      const l = lender(p.creditor);
      lenders.set(l.lender.id, { ...l, paidSatang: l.paidSatang + p.amountSatang });
    }
    const others = [...lenders.values()].map((l) => ({ ...l, balanceSatang: l.owedSatang - l.paidSatang }));

    const farm: Payer = { id: FARM_FUNDS, name: '' };
    const history: HistoryLine[] = [
      ...ds.map((d) => ({
        id: d.id,
        type: d.kind,
        signedSatang: d.amountSatang,
        date: d.date,
        saleId: null,
        deleted: d.deleted,
        creditor: d.kind === 'loan' && d.lender ? d.lender : farm,
      })),
      ...ps.map((p) => ({
        id: p.id,
        type: p.method === 'outside' ? ('payment' as const) : ('deduction' as const),
        signedSatang: -p.amountSatang,
        date: p.date,
        saleId: p.saleId,
        deleted: p.deleted || !p.counts,
        creditor: p.creditor,
      })),
    ].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.id < b.id ? 1 : -1));

    out.set(wid, {
      worker,
      balanceSatang: balance,
      overpaid: balance < 0,
      summary: { owed, deducted, outside, balanceSatang: balance },
      others,
      planPerSaleSatang: plans.get(wid) ?? null,
      history,
      debts: ds,
      payments: ps,
    });
  }
  return out;
}

/**
 * The farm debt left right after one sale (review F9): today's balance plus
 * what later days' sales and payments took off, less the debts added since.
 * Records carry a day, not a time, so the rest of the sale day counts as
 * before it; for the latest sale this is today's balance.
 */
export function balanceAfterSale(account: DebtAccount, saleId: string, saleDate: string): number {
  let b = account.balanceSatang;
  for (const p of account.payments) {
    if (p.deleted || !p.counts || !toFarm(p.creditor) || p.saleId === saleId) continue;
    if (p.date > saleDate) b += p.amountSatang;
  }
  for (const d of account.debts) {
    if (d.deleted || (d.kind === 'loan' && !toFarm(d.lender))) continue;
    if (d.date > saleDate) b -= d.amountSatang;
  }
  return b;
}
