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

import { projectDebts, type DebtAccount } from './debts';
import { OWNER_PAYEE, paymentStatus } from './payments';
import type { DebtPaymentFields, FinanceEvent, FinancePayload } from './types';

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
      // One tick (debt-cash-<id>) covers buyer-split and picks alike: one line, "picked" if any is a pick (as pay-screen.tsx).
      const key = `${p.saleId}|${a.worker.id}|${how === 'transfer' ? 'transfer' : 'cash'}`;
      const prev = by.get(key);
      by.set(key, {
        saleId: p.saleId,
        date: prev && prev.date < p.date ? prev.date : p.date,
        workerId: a.worker.id,
        name: a.worker.name,
        satang: (prev?.satang ?? 0) + p.amountSatang,
        how: prev?.how === 'picked' ? 'picked' : how,
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
 * Per sale, what the buyer still owes the farm (D-87): what should have come
 * in today minus what a tick recorded as received (review 2026-11-01: never
 * the stale gap at tick time — a deduction voided or cut after the tick moves
 * it). Repayment cash is measured against the worker's live buyer-split and
 * pick lines on that sale; the owner's transfer against `ownerTransfer` when
 * the caller knows today's transfer (the payment page), else against the
 * ticked amount (the tick then shows "ต้องตรวจใหม่" there). Ticks in conflict
 * owe nothing until someone picks (D-30); a cancelled sale owes nothing.
 */
export function buyerOwes(
  events: readonly FinanceEvent[],
  saleCounts: (saleId: string) => boolean = () => true,
  opts: { readonly ownerTransfer?: (saleId: string) => number | undefined } = {},
): BuyerOwes[] {
  const payees = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.payload.t !== 'payment_mark_set') continue;
    const { saleId, payee } = e.payload;
    if (payee !== OWNER_PAYEE && !payee.startsWith('debt-cash-')) continue;
    payees.set(saleId, (payees.get(saleId) ?? new Set()).add(payee));
  }
  if (!payees.size) return [];
  const accounts = projectDebts(events, saleCounts);
  const cashNow = (saleId: string, workerId: string) =>
    (accounts.get(workerId)?.payments ?? [])
      .filter((p) => p.saleId === saleId && !p.deleted && p.counts && (p.method === 'buyer-split' || p.method === 'cash-from-share'))
      .reduce((a, p) => a + p.amountSatang, 0);
  const out: BuyerOwes[] = [];
  for (const [saleId, set] of payees) {
    if (!saleCounts(saleId)) continue;
    const short = (payee: string, now: number | undefined) => {
      const st = paymentStatus(events, saleId, payee, 0);
      if (!st.done || st.receivedSatang === null || !st.shortSatang) return 0;
      return Math.max(0, (now ?? st.amountAtMarkSatang ?? 0) - st.receivedSatang);
    };
    const transferSatang = set.has(OWNER_PAYEE) ? short(OWNER_PAYEE, opts.ownerTransfer?.(saleId)) : 0;
    const cash = [...set]
      .filter((p) => p !== OWNER_PAYEE)
      .sort()
      .map((p) => {
        const workerId = p.slice('debt-cash-'.length);
        return { workerId, satang: short(p, cashNow(saleId, workerId)) };
      })
      .filter((c) => c.satang > 0);
    const totalSatang = transferSatang + cash.reduce((a, c) => a + c.satang, 0);
    if (totalSatang > 0) out.push({ saleId, transferSatang, cash, totalSatang });
  }
  return out.sort((x, y) => x.saleId.localeCompare(y.saleId));
}

export interface RouteLine {
  readonly id: string;
  readonly headEventId: string;
  readonly fields: DebtPaymentFields;
}

export interface RouteFixWrite {
  readonly id: string;
  readonly base: string | null;
  readonly payload: FinancePayload;
}

/**
 * PR-17 / PR-19 / D-87: the repayment money stayed with the worker — the farm
 * lifted less from the worker's pile than it deducted, or the buyer handed it
 * to the worker. Only `keptSatang` reached the farm, so the deduction becomes
 * that. Written as events on the sale's payment page only (architecture
 * §ติ๊กจ่าย): every route line is voided (kept in the history, struck through)
 * and, when something did come, one new line of the same kind holds it — so
 * the history shows both the old deduction and the change.
 */
export function routeFixWrites(lines: readonly RouteLine[], keptSatang: number, newId: (prefix: string) => string): RouteFixWrite[] {
  const total = lines.reduce((a, l) => a + l.fields.amountSatang, 0);
  if (!Number.isSafeInteger(keptSatang) || keptSatang < 0 || keptSatang > total) throw new Error(`kept must be an integer from 0 to ${total}`);
  if (keptSatang === total || !lines.length) return [];
  const out: RouteFixWrite[] = lines.map((l) => ({ id: l.id, base: l.headEventId, payload: { t: 'debt_payment_changed', patch: { deleted: true } } }));
  if (keptSatang > 0) out.push({ id: newId('dpay-'), base: null, payload: { t: 'debt_payment_recorded', fields: { ...lines[lines.length - 1].fields, amountSatang: keptSatang } } });
  return out;
}
