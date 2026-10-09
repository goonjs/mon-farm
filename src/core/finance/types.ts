/**
 * The farm finance ledger (E11): expenses, money the farm owes back, and
 * repayments. Pure types — nothing here imports react, react-native or expo.
 *
 * MONEY IS INTEGER SATANG, as everywhere in `src/core` (NFR-3).
 * DATES ARE "YYYY-MM-DD" — the calendar day the money moved, chosen by a
 * person; it is a fact about the expense, not a clock reading, so ordering by
 * it is allowed (the device `ts` still never orders anything).
 *
 * ── Shape: the architecture's record model, already ─────────────────────────
 *
 * Every event names the record it creates or changes (`targetId`) and, for a
 * change, the head the editor saw (`baseEventId`) — the model in
 * architecture §Sync engine. Two changes with the same base are concurrent;
 * the projection merges them field by field and raises a Conflict when both
 * touched a money or stage field (D-30), instead of letting one silently win.
 *
 * Expenses are not sale-scoped, so they live in their own append-only log
 * (`src/store/finance.ts`) rather than in a sale's — the sale log is still
 * keyed `(saleId, seq)` until the envelope redesign lands (E04-S01), and the
 * two meet in one `events` table then.
 */

import type { Actor, EventId, Source } from '../types';

/** The payer id for the farm's own money — "เงินสวน" (D-62). Creates nothing owed back. */
export const FARM_FUNDS = 'farm';

/** Who paid / who is repaid. `name` is a snapshot, like `workerName` on a contract. */
export interface Payer {
  readonly id: string;
  readonly name: string;
}

export type Stage = 'actual' | 'committed' | 'planned';

export interface ExpenseFields {
  /** null only while planned — "ไม่ทราบ", never a silent zero (D-62, SYNC-12). */
  readonly amountSatang: number | null;
  readonly date: string;
  readonly stage: Stage;
  readonly categoryId: string | null;
  /** Optional: which farm (สวน) — E03-S02 ids. */
  readonly propertyId: string | null;
  readonly item: string;
  readonly note: string;
  /** null = not recorded yet (F7: fertilizer owner-share expenses may leave it for later). */
  readonly payer: Payer | null;
}

/** Fields an edit may set. `deleted` is Soft Delete (SYNC-10), carried as one more field. */
export type ExpensePatch = Partial<ExpenseFields> & { readonly deleted?: boolean };

export interface Allocation {
  readonly expenseId: string;
  readonly satang: number;
}

export interface RepaymentFields {
  /** Who handed the money over — default farm funds (D-59). */
  readonly from: Payer;
  /** Who received it — default the person owed. */
  readonly to: Payer;
  readonly amountSatang: number;
  readonly date: string;
  readonly note: string;
  /** Which debts this repays; sums to `amountSatang`. Oldest-first by default (D-67). */
  readonly allocations: readonly Allocation[];
  /** Set when the repayment is netting at a sale's settlement (D-60). */
  readonly saleId: string | null;
}

export type RepaymentPatch = Partial<RepaymentFields> & { readonly deleted?: boolean };

// ── Worker debts (E06-S03) ──────────────────────────────────────────────────

export type DebtKind = 'loan' | 'fertilizer' | 'other';

export interface DebtFields {
  readonly worker: Payer;
  readonly kind: DebtKind;
  /** What the worker owes — for fertilizer, their share of the bill. */
  readonly amountSatang: number;
  readonly date: string;
  /** Required for "other" (D-59); for fertilizer it is what a later fertilizer system matches on. */
  readonly note: string;
  /** Loans only: who lent it. Farm funds = deductible; anyone else = shown, never deducted (D-69). */
  readonly lender: Payer | null;
  /** Manual fertilizer debt (D-59): the bill and the whole-number % the worker carries (F8). */
  readonly fertilizer: { readonly totalSatang: number; readonly workerPct: number } | null;
  /** Balance from before the app (F6) — still one of the three kinds. */
  readonly carriedForward: boolean;
}

export type DebtPatch = Partial<DebtFields> & { readonly deleted?: boolean };

/**
 * How a repayment reached the creditor. The three settlement methods are
 * D-71's; `netting` is the farm's own money owed back set against the debt
 * (D-60); `outside` is paid back away from any sale.
 */
export type DebtPaymentMethod = 'outside' | 'cash-from-share' | 'buyer-split' | 'transfer-with-owner' | 'netting';

export interface DebtPaymentFields {
  readonly worker: Payer;
  /** Farm funds, or the outside lender the worker paid directly (D-69). */
  readonly creditor: Payer;
  readonly amountSatang: number;
  readonly date: string;
  readonly note: string;
  readonly method: DebtPaymentMethod;
  /** The sale it was deducted at; a cancelled/deleted sale's deductions stop counting. */
  readonly saleId: string | null;
  /** Netting only: the farm-side repayment written with it, so the two void together. */
  readonly repaymentId?: string;
}

export type DebtPaymentPatch = Partial<DebtPaymentFields> & { readonly deleted?: boolean };

// ── Receiving accounts (E05-S07) ────────────────────────────────────────────

export interface AccountFields {
  /** What the owner calls it, e.g. "บัญชีหลัก". */
  readonly label: string;
  readonly bankCode: string | null;
  readonly accountNo: string;
  readonly accountName: string;
  readonly promptPay: { readonly type: 'mobile' | 'nationalId'; readonly id: string } | null;
}

export type AccountPatch = Partial<AccountFields> & { readonly deleted?: boolean };

/** Where a sale's owner transfer goes — an account, cash, a free note, or nothing recorded (all optional, D-38). */
export type SaleAccountChoice =
  | { readonly kind: 'account'; readonly accountId: string }
  | { readonly kind: 'cash' }
  | { readonly kind: 'note'; readonly note: string };

export type FinancePayload =
  | { readonly t: 'expense_created'; readonly fields: ExpenseFields }
  | { readonly t: 'expense_changed'; readonly patch: ExpensePatch; readonly alsoBasedOn?: readonly EventId[] }
  | { readonly t: 'category_added'; readonly name: string }
  | { readonly t: 'category_renamed'; readonly name: string }
  | { readonly t: 'repayment_recorded'; readonly fields: RepaymentFields }
  | { readonly t: 'repayment_changed'; readonly patch: RepaymentPatch; readonly alsoBasedOn?: readonly EventId[] }
  | { readonly t: 'debt_added'; readonly fields: DebtFields }
  | { readonly t: 'debt_changed'; readonly patch: DebtPatch; readonly alsoBasedOn?: readonly EventId[] }
  | { readonly t: 'debt_payment_recorded'; readonly fields: DebtPaymentFields }
  | { readonly t: 'debt_payment_changed'; readonly patch: DebtPaymentPatch; readonly alsoBasedOn?: readonly EventId[] }
  /** One plan per worker (targetId `plan-<workerId>`); null cancels it. Instalment = per sale (D-59). */
  | { readonly t: 'debt_plan_set'; readonly worker: Payer; readonly perSaleSatang: number | null }
  | { readonly t: 'account_added'; readonly fields: AccountFields }
  | { readonly t: 'account_changed'; readonly patch: AccountPatch; readonly alsoBasedOn?: readonly EventId[] }
  /** targetId `default-account`; null = no default. */
  | { readonly t: 'account_default_set'; readonly accountId: string | null }
  /** targetId `sale-account-<saleId>`; null clears the choice. */
  | { readonly t: 'sale_account_set'; readonly saleId: string; readonly choice: SaleAccountChoice | null };

export interface FinanceEvent {
  readonly id: EventId;
  readonly deviceSeq: number;
  /** Wall clock, for people reading the log. Never orders anything. */
  readonly ts: number;
  readonly actor: Actor;
  readonly source: Source;
  readonly targetId: string;
  /** The head the editor saw; null creates the record. */
  readonly baseEventId: EventId | null;
  readonly payload: FinancePayload;
}
