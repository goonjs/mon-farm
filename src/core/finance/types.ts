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

export type FinancePayload =
  | { readonly t: 'expense_created'; readonly fields: ExpenseFields }
  | { readonly t: 'expense_changed'; readonly patch: ExpensePatch; readonly alsoBasedOn?: readonly EventId[] }
  | { readonly t: 'category_added'; readonly name: string }
  | { readonly t: 'category_renamed'; readonly name: string }
  | { readonly t: 'repayment_recorded'; readonly fields: RepaymentFields }
  | { readonly t: 'repayment_changed'; readonly patch: RepaymentPatch; readonly alsoBasedOn?: readonly EventId[] };

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
