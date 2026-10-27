/**
 * The shop order (E11-S11): one order = several items bought together, saved
 * first; reasons, zones and tapper share are told per item later.
 *
 * Model (solution-architect, ADR in the story): ONE EXPENSE PER ITEM, grouped
 * by `ExpenseFields.orderId`. The existing split/debt/owed engine therefore
 * works per item unchanged. Fertilizer items carry `fertilizer` details
 * (category `cat-fertilizer`); other items are plain expenses of their own
 * category. Legacy single expenses (no `orderId`) read as one-item orders.
 *
 * STUB: the contract (names, types, rules in the comments) is fixed — the UI
 * workers import it now; the bodies are written test-first in
 * `fert-order.test.ts`. Pure functions only: no React, no storage, no clocks.
 */

import type { Expense } from './ledger';
import type { ExpenseFields, ExpensePatch, FertilizerType, Payer, Stage } from './types';

export const FERTILIZER_CATEGORY = 'cat-fertilizer';

export interface OrderLineDraft {
  /** Client id of the item; the expense id is `${orderId}-${id}` (stable, so a retry cannot double it). */
  readonly id: string;
  readonly categoryId: string;
  /** What the list shows: the formula (+ brand) for fertilizer, the typed name otherwise. */
  readonly item: string;
  /** Present exactly when `categoryId === FERTILIZER_CATEGORY`. */
  readonly fertilizer?: { readonly type: FertilizerType; readonly formula: string; readonly brand: string; readonly sackKg: number | null };
  readonly qty: number;
  readonly unit: string;
  readonly grossSatang: number;
  readonly itemDiscountSatang: number;
}

export interface OrderDraft {
  readonly orderId: string;
  readonly date: string;
  /** An order starts "สั่งไว้" (committed) or "ได้ของแล้ว" (actual); "planned" is not offered here. */
  readonly stage: 'committed' | 'actual';
  readonly payer: Payer | null;
  readonly shop: string;
  readonly orderedBy: string;
  readonly propertyId: string | null;
  /** The bill-level discount ("ร้านลดให้ทั้งใบ"), allocated over the items. */
  readonly billDiscountSatang: number;
  readonly lines: readonly OrderLineDraft[];
}

export type OrderProblem =
  | 'no-lines'
  | 'date-required'
  | 'line-qty' // qty not a whole number ≥ 1
  | 'line-price' // gross ≤ 0 or not a safe integer
  | 'line-name-required' // empty formula / name
  | 'item-discount-over' // an item's own discount > its gross
  | 'bill-discount-over'; // bill discount > the sum of the items' nets

export interface OrderProblems {
  readonly order: readonly OrderProblem[];
  /** Problems per line, by `OrderLineDraft.id`. */
  readonly lines: Readonly<Record<string, readonly OrderProblem[]>>;
}

/** gross − item discount (≥ 0 when valid). */
export const lineNetSatang = (_l: Pick<OrderLineDraft, 'grossSatang' | 'itemDiscountSatang'>): number => {
  throw new Error('not implemented');
};

/**
 * Largest-remainder split of `discountSatang` over `netsSatang` in proportion to each net,
 * exact to the satang: the result sums to `discountSatang`, no entry exceeds its net, ties go to the
 * earlier index. Throws RangeError when the discount exceeds the sum of the nets. `[]` → `[]` (discount must be 0).
 */
export const allocateBillDiscount = (_netsSatang: readonly number[], _discountSatang: number): number[] => {
  throw new Error('not implemented');
};

export const checkOrder = (_d: OrderDraft): OrderProblems => {
  throw new Error('not implemented');
};

export interface OrderTotals {
  readonly grossSatang: number;
  readonly itemDiscountSatang: number;
  readonly billDiscountSatang: number;
  /** gross − item discounts − bill discount: what is paid. */
  readonly netSatang: number;
  /** Fertilizer sacks only. */
  readonly sacks: number;
  readonly lineCount: number;
}

export const orderTotals = (_d: OrderDraft): OrderTotals => {
  throw new Error('not implemented');
};

/**
 * The expenses to create, in line order. Each: `amountSatang` = net after its allocated bill discount,
 * `discountSatang` = item discount + allocated share, `orderId`, `line`, the order's date/stage/payer/propertyId,
 * `item`, `note: ''`, and for fertilizer lines `fertilizer` = { type, formula, brand, sackKg, reasons: [], zones: [],
 * shop, orderedBy, sacks: qty, pricePerSackSatang: round(gross / qty), itemDiscountSatang }.
 * `share` is left ABSENT (not null): absent = tappers not decided yet. Throws when `checkOrder` finds a problem.
 */
export const buildOrderExpenses = (_d: OrderDraft): { readonly id: string; readonly fields: ExpenseFields }[] => {
  throw new Error('not implemented');
};

/** What a view of one order shows. Built from live (not deleted) expenses. */
export interface OrderView {
  /** The shared `orderId`; for a legacy single expense, its own id. */
  readonly orderId: string;
  readonly legacy: boolean;
  /** Items in creation order (by expense id). */
  readonly items: readonly Expense[];
  readonly date: string;
  /** The newest edit wins when items disagree (sync mid-flight); see `consistent`. */
  readonly stage: Stage;
  readonly payer: Payer | null;
  readonly shop: string;
  /** Sum of the items' net amounts (null amounts count as 0). */
  readonly netSatang: number;
  readonly billDiscountSatang: number;
  /** false when items disagree on date, stage or payer — the UI offers to rewrite them all. */
  readonly consistent: boolean;
}

/** Groups live expenses by `orderId`; expenses without one each become a legacy one-item order. Newest date first, then id. */
export const groupOrders = (_expenses: readonly Expense[]): OrderView[] => {
  throw new Error('not implemented');
};

export type DetailKey = 'reasons' | 'zones' | 'tappers';

/**
 * What is still untold on a FERTILIZER item (other items → []):
 * reasons — none chosen; zones — placed sacks < sacks; tappers — `share` key absent
 * (`share: null` = decided "not shared", a share with lines = told).
 * Sacks come from `fertilizer.sacks`, else `share.totalSacks`.
 */
export const missingDetails = (_e: Expense): DetailKey[] => {
  throw new Error('not implemented');
};

/** Fertilizer items fully told / all fertilizer items of the order. */
export const orderProgress = (_o: OrderView): { readonly done: number; readonly total: number } => {
  throw new Error('not implemented');
};

/** One write per item: `expense_changed` on each item's head. */
export interface OrderPatchWrite {
  readonly id: string;
  readonly baseEventId: string;
  readonly patch: ExpensePatch;
}

/** Shared fields (date, stage, payer, shop/orderedBy inside `fertilizer`, propertyId) rewritten on EVERY item; only keys that differ are patched. */
export const patchOrderFields = (
  _o: OrderView,
  _next: { readonly date?: string; readonly stage?: 'committed' | 'actual'; readonly payer?: Payer | null; readonly shop?: string; readonly orderedBy?: string; readonly propertyId?: string | null },
): OrderPatchWrite[] => {
  throw new Error('not implemented');
};

/** "ของมาแล้ว": every item → stage `actual` (items already actual are skipped). */
export const deliverOrder = (_o: OrderView): OrderPatchWrite[] => {
  throw new Error('not implemented');
};
