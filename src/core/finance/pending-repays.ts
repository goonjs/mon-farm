/**
 * E06-S08 · repayments not received yet, across sales, and what the buyer
 * still owes the farm (D-87).
 *
 * At close-out a deduction lowers the worker's debt at once (D-85); the money
 * for it reaches the farm by one of three routes, each with its own tick on the
 * sale's payment page (E05-S11 CO-25, the same rule as `pendingRepays` there):
 *
 * - transfer-with-owner → the owner's transfer tick (OWNER_PAYEE), one tick for
 *   the whole transfer of the sale;
 * - buyer-split / cash-from-share → the `debt-cash-<workerId>` tick.
 *
 * `pendingRepays` in closeout.ts reads one sale's plan; the debt ledger needs
 * every sale for a worker, so this reads the recorded deduction lines and the
 * ticks straight from the log (lead 2026-11-01: a new E06 file, E05-S11 adds
 * nothing). A tick that recorded less than it should (`receivedSatang`) is no
 * longer pending: the gap is the buyer owing the farm, never the worker's debt.
 */

import type { DebtAccount } from './debts';
import { OWNER_PAYEE, paymentStatus } from './payments';
import type { FinanceEvent } from './types';

/**
 * Owner Q3 (2026-11-01): sales dated before this day are treated as received —
 * the ledger only flags what was closed with this feature in place.
 */
export const PENDING_REPAY_SINCE = '2026-11-01';

/** transfer: in the owner's transfer · cash: the buyer hands it over · picked: the farm lifts it from the worker's own pile. */
export type PendingHow = 'transfer' | 'cash' | 'picked';

export interface PendingRepayLine {
  readonly saleId: string;
  /** The deduction's date — the sale's day. */
  readonly date: string;
  readonly workerId: string;
  readonly name: string;
  readonly satang: number;
  readonly how: PendingHow;
}

export const debtCashPayee = (workerId: string) => `debt-cash-${workerId}`;

const HOW = { 'transfer-with-owner': 'transfer', 'buyer-split': 'cash', 'cash-from-share': 'picked' } as const;
type RouteMethod = keyof typeof HOW;
const isRoute = (m: string): m is RouteMethod => m in HOW;

/**
 * Every (sale, worker, route) whose money has not been ticked as received —
 * oldest sale first, then by worker id. Deductions at cancelled sales and
 * voided lines do not count (the accounts already say so); outside payments and
 * netting move no money.
 */
export function pendingRepayLines(events: readonly FinanceEvent[], accounts: ReadonlyMap<string, DebtAccount>, since = PENDING_REPAY_SINCE): PendingRepayLine[] {
  const by = new Map<string, PendingRepayLine>();
  for (const a of accounts.values()) {
    for (const p of a.payments) {
      if (p.deleted || !p.counts || !p.saleId || !isRoute(p.method) || p.date < since) continue;
      const how = HOW[p.method];
      const key = `${p.saleId}|${a.worker.id}|${how}`;
      const prev = by.get(key);
      by.set(key, {
        saleId: p.saleId,
        date: prev && prev.date < p.date ? prev.date : p.date,
        workerId: a.worker.id,
        name: a.worker.name,
        satang: (prev?.satang ?? 0) + p.amountSatang,
        how,
      });
    }
  }
  const done = (l: PendingRepayLine) => paymentStatus(events, l.saleId, l.how === 'transfer' ? OWNER_PAYEE : debtCashPayee(l.workerId), l.satang).done;
  return [...by.values()]
    .filter((l) => l.satang > 0 && !done(l))
    .sort((x, y) => x.date.localeCompare(y.date) || x.saleId.localeCompare(y.saleId) || x.workerId.localeCompare(y.workerId));
}

export interface BuyerOwes {
  readonly saleId: string;
  /** The owner's transfer came in short by this much. */
  readonly transferSatang: number;
  /** Repayment cash recorded short, per worker. */
  readonly cash: readonly { readonly workerId: string; readonly satang: number }[];
  readonly totalSatang: number;
}

/**
 * Per sale, what the buyer still owes the farm (D-87): the short part of every
 * tick that recorded less than it should. Ticks in conflict owe nothing until
 * someone picks (D-30); a cancelled sale owes nothing.
 */
export function buyerOwes(events: readonly FinanceEvent[], saleCounts: (saleId: string) => boolean = () => true): BuyerOwes[] {
  const payees = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.payload.t !== 'payment_mark_set') continue;
    const { saleId, payee } = e.payload;
    if (payee !== OWNER_PAYEE && !payee.startsWith('debt-cash-')) continue;
    payees.set(saleId, (payees.get(saleId) ?? new Set()).add(payee));
  }
  const out: BuyerOwes[] = [];
  for (const [saleId, set] of payees) {
    if (!saleCounts(saleId)) continue;
    // The amount argument only drives "recheck"; the short part is fixed by the tick itself.
    const short = (payee: string) => paymentStatus(events, saleId, payee, 0).shortSatang;
    const transferSatang = set.has(OWNER_PAYEE) ? short(OWNER_PAYEE) : 0;
    const cash = [...set]
      .filter((p) => p !== OWNER_PAYEE)
      .sort()
      .map((p) => ({ workerId: p.slice('debt-cash-'.length), satang: short(p) }))
      .filter((c) => c.satang > 0);
    const totalSatang = transferSatang + cash.reduce((a, c) => a + c.satang, 0);
    if (totalSatang > 0) out.push({ saleId, transferSatang, cash, totalSatang });
  }
  return out.sort((x, y) => x.saleId.localeCompare(y.saleId));
}

export interface PickLine {
  readonly id: string;
  readonly headEventId: string;
  readonly amountSatang: number;
}

export interface PickPatch {
  readonly id: string;
  readonly head: string;
  readonly patch: { readonly deleted: true } | { readonly amountSatang: number };
}

/**
 * PR-17 / D-87: the farm meant to lift the repayment from the worker's own
 * pile (cash-from-share) but lifted only `pickedSatang`. The money is with the
 * worker, so the deduction shrinks to what was picked — written as
 * `debt_payment_changed` on the existing lines (newest cut first; a line cut
 * to nothing is voided, so the history keeps it, struck through). The owner
 * does this on the sale's payment page only (architecture §ติ๊กจ่าย).
 */
export function pickFixPatches(lines: readonly PickLine[], pickedSatang: number): PickPatch[] {
  const total = lines.reduce((a, l) => a + l.amountSatang, 0);
  if (!Number.isSafeInteger(pickedSatang) || pickedSatang < 0 || pickedSatang > total) throw new Error(`picked must be an integer from 0 to ${total}`);
  let cut = total - pickedSatang;
  const out: PickPatch[] = [];
  for (const l of [...lines].reverse()) {
    if (cut <= 0) break;
    const take = Math.min(cut, l.amountSatang);
    cut -= take;
    out.push({ id: l.id, head: l.headEventId, patch: take === l.amountSatang ? { deleted: true } : { amountSatang: l.amountSatang - take } });
  }
  return out;
}
