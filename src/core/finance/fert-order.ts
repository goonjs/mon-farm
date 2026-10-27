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
 * Pure functions only: no React, no storage, no clocks. Money is integer
 * satang end to end; the one place a product can pass 2^53 (nets × discount)
 * is done in BigInt so the bill-discount split stays exact.
 */

import type { Expense } from './ledger';
import type { ExpenseFields, ExpensePatch, FertilizerDetails, FertilizerType, Payer, Stage } from './types';

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

const isFertilizerLine = (l: Pick<OrderLineDraft, 'categoryId'>) => l.categoryId === FERTILIZER_CATEGORY;

const isSatang = (n: number) => Number.isSafeInteger(n) && n >= 0;

/** gross − item discount (≥ 0 when valid). */
export const lineNetSatang = (l: Pick<OrderLineDraft, 'grossSatang' | 'itemDiscountSatang'>): number => l.grossSatang - l.itemDiscountSatang;

/**
 * Largest-remainder split of `discountSatang` over `netsSatang` in proportion to each net,
 * exact to the satang: the result sums to `discountSatang`, no entry exceeds its net, ties go to the
 * earlier index. Throws RangeError when the discount exceeds the sum of the nets. `[]` → `[]` (discount must be 0).
 */
export const allocateBillDiscount = (netsSatang: readonly number[], discountSatang: number): number[] => {
  if (!isSatang(discountSatang)) throw new RangeError('discount must be a whole number of satang ≥ 0');
  if (netsSatang.some((n) => !isSatang(n))) throw new RangeError('nets must be whole satang ≥ 0');
  const total = netsSatang.reduce((a, b) => a + b, 0);
  if (discountSatang > total) throw new RangeError('discount is more than the sum of the nets');
  if (discountSatang === 0 || total === 0) return netsSatang.map(() => 0);
  // net × discount can pass 2^53 for big orders (100M baht × 100M baht), so the quotient and
  // remainder are taken in BigInt; the results fit back into a number because share ≤ net.
  const S = BigInt(total);
  const D = BigInt(discountSatang);
  const exact = netsSatang.map((n) => {
    const p = BigInt(n) * D;
    return { floor: Number(p / S), rem: p % S };
  });
  const out = exact.map((e) => e.floor);
  let left = discountSatang - out.reduce((a, b) => a + b, 0);
  // Only items with a remainder > 0 can be picked (leftover < their count), so no entry passes its net.
  const order = exact.map((e, i) => i).sort((a, b) => (exact[a].rem === exact[b].rem ? a - b : exact[a].rem > exact[b].rem ? -1 : 1));
  for (const i of order) {
    if (left === 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const checkOrder = (d: OrderDraft): OrderProblems => {
  const order: OrderProblem[] = [];
  if (d.lines.length === 0) order.push('no-lines');
  if (!DATE_RE.test(d.date)) order.push('date-required');
  const lines: Record<string, OrderProblem[]> = {};
  let nets = 0;
  for (const l of d.lines) {
    const p: OrderProblem[] = [];
    if (!Number.isSafeInteger(l.qty) || l.qty < 1) p.push('line-qty');
    if (!Number.isSafeInteger(l.grossSatang) || l.grossSatang <= 0) p.push('line-price');
    const name = isFertilizerLine(l) ? l.fertilizer?.formula : l.item;
    if (!name || !name.trim()) p.push('line-name-required');
    if (!isSatang(l.itemDiscountSatang) || l.itemDiscountSatang > l.grossSatang) p.push('item-discount-over');
    else if (Number.isSafeInteger(l.grossSatang)) nets += l.grossSatang - l.itemDiscountSatang;
    lines[l.id] = p;
  }
  if (!isSatang(d.billDiscountSatang) || d.billDiscountSatang > nets) order.push('bill-discount-over');
  return { order, lines };
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

export const orderTotals = (d: OrderDraft): OrderTotals => {
  const grossSatang = d.lines.reduce((s, l) => s + l.grossSatang, 0);
  const itemDiscountSatang = d.lines.reduce((s, l) => s + l.itemDiscountSatang, 0);
  return {
    grossSatang,
    itemDiscountSatang,
    billDiscountSatang: d.billDiscountSatang,
    netSatang: grossSatang - itemDiscountSatang - d.billDiscountSatang,
    sacks: d.lines.filter(isFertilizerLine).reduce((s, l) => s + l.qty, 0),
    lineCount: d.lines.length,
  };
};

/** Gross per sack to the satang, half up, in integers (a float 0.5 edge must not flip the price). */
const roundedPer = (gross: number, qty: number) => Math.floor((2 * gross + qty) / (2 * qty));

/**
 * The expenses to create, in line order. Each: `amountSatang` = net after its allocated bill discount,
 * `discountSatang` = item discount + allocated share, `orderId`, `line`, the order's date/stage/payer/propertyId,
 * `item`, `note: ''`, and for fertilizer lines `fertilizer` = { type, formula, brand, sackKg, reasons: [], zones: [],
 * shop, orderedBy, sacks: qty, pricePerSackSatang: round(gross / qty), itemDiscountSatang }.
 * `share` is left ABSENT (not null): absent = tappers not decided yet. Throws when `checkOrder` finds a problem.
 */
export const buildOrderExpenses = (d: OrderDraft): { readonly id: string; readonly fields: ExpenseFields }[] => {
  const problems = checkOrder(d);
  if (problems.order.length || Object.values(problems.lines).some((p) => p.length)) {
    throw new Error(`invalid order: ${[...problems.order, ...Object.values(problems.lines).flat()].join(', ')}`);
  }
  const shares = allocateBillDiscount(d.lines.map(lineNetSatang), d.billDiscountSatang);
  return d.lines.map((l, i) => {
    const discountSatang = l.itemDiscountSatang + shares[i];
    const base: ExpenseFields = {
      amountSatang: l.grossSatang - discountSatang,
      date: d.date,
      stage: d.stage,
      categoryId: l.categoryId,
      propertyId: d.propertyId,
      item: l.item,
      note: '',
      payer: d.payer,
      orderId: d.orderId,
      discountSatang,
      line: { qty: l.qty, unit: l.unit, grossSatang: l.grossSatang, itemDiscountSatang: l.itemDiscountSatang },
    };
    if (!isFertilizerLine(l) || !l.fertilizer) return { id: `${d.orderId}-${l.id}`, fields: base };
    const fertilizer: FertilizerDetails = {
      ...l.fertilizer,
      reasons: [],
      zones: [],
      shop: d.shop,
      orderedBy: d.orderedBy,
      sacks: l.qty,
      pricePerSackSatang: roundedPer(l.grossSatang, l.qty),
      itemDiscountSatang: l.itemDiscountSatang,
    };
    return { id: `${d.orderId}-${l.id}`, fields: { ...base, fertilizer } };
  });
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

const byIdAsc = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Groups live expenses by `orderId`; expenses without one each become a legacy one-item order. Newest date first, then id. */
export const groupOrders = (expenses: readonly Expense[]): OrderView[] => {
  const groups = new Map<string, { legacy: boolean; items: Expense[] }>();
  for (const x of expenses) {
    if (x.deleted) continue;
    const legacy = !x.orderId;
    const key = legacy ? x.id : (x.orderId as string);
    const g = groups.get(key) ?? { legacy, items: [] };
    g.items.push(x);
    groups.set(key, g);
  }
  const views = [...groups].map(([orderId, g]): OrderView => {
    const items = [...g.items].sort(byIdAsc);
    // Which item is "newest" is not known here (no event order on the projection), so the one whose id sorts last speaks for the order.
    const newest = items[items.length - 1];
    const same = (f: (x: Expense) => unknown) => items.every((x) => f(x) === f(newest));
    const shopItem = [...items].reverse().find((x) => x.fertilizer);
    return {
      orderId,
      legacy: g.legacy,
      items,
      date: newest.date,
      stage: newest.stage,
      payer: newest.payer,
      shop: shopItem?.fertilizer?.shop ?? '',
      netSatang: items.reduce((s, x) => s + (x.amountSatang ?? 0), 0),
      billDiscountSatang: items.reduce((s, x) => s + (x.discountSatang ?? 0) - (x.line?.itemDiscountSatang ?? 0), 0),
      consistent: same((x) => x.date) && same((x) => x.stage) && same((x) => x.payer?.id ?? null),
    };
  });
  return views.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.orderId < b.orderId ? -1 : a.orderId > b.orderId ? 1 : 0));
};

export type DetailKey = 'reasons' | 'zones' | 'tappers';

/**
 * What is still untold on a FERTILIZER item (other items → []):
 * reasons — none chosen; zones — placed sacks < sacks; tappers — `share` key absent
 * (`share: null` = decided "not shared", a share with lines = told).
 * Sacks come from `fertilizer.sacks`, else `share.totalSacks`.
 */
export const missingDetails = (e: Expense): DetailKey[] => {
  const f = e.fertilizer;
  if (!f) return [];
  const out: DetailKey[] = [];
  if (f.reasons.length === 0) out.push('reasons');
  const sacks = f.sacks ?? e.share?.totalSacks ?? null;
  const placed = f.zones.reduce((s, z) => s + z.sacks, 0);
  // Without a known sack count there is nothing to compare to: any recorded zone counts as told.
  if (sacks === null ? f.zones.length === 0 : placed < sacks) out.push('zones');
  if (e.share === undefined) out.push('tappers');
  return out;
};

/** Fertilizer items fully told / all fertilizer items of the order. */
export const orderProgress = (o: OrderView): { readonly done: number; readonly total: number } => {
  const fert = o.items.filter((x) => x.fertilizer);
  return { done: fert.filter((x) => missingDetails(x).length === 0).length, total: fert.length };
};

/** One write per item: `expense_changed` on each item's head. */
export interface OrderPatchWrite {
  readonly id: string;
  readonly baseEventId: string;
  readonly patch: ExpensePatch;
}

/** Shared fields (date, stage, payer, shop/orderedBy inside `fertilizer`, propertyId) rewritten on EVERY item; only keys that differ are patched. */
export const patchOrderFields = (
  o: OrderView,
  next: { readonly date?: string; readonly stage?: 'committed' | 'actual'; readonly payer?: Payer | null; readonly shop?: string; readonly orderedBy?: string; readonly propertyId?: string | null },
): OrderPatchWrite[] => {
  const writes: OrderPatchWrite[] = [];
  for (const x of o.items) {
    const patch: { -readonly [K in keyof ExpensePatch]: ExpensePatch[K] } = {};
    if (next.date !== undefined && next.date !== x.date) patch.date = next.date;
    if (next.stage !== undefined && next.stage !== x.stage) patch.stage = next.stage;
    if (next.payer !== undefined && (next.payer?.id ?? null) !== (x.payer?.id ?? null)) patch.payer = next.payer;
    if (next.propertyId !== undefined && next.propertyId !== x.propertyId) patch.propertyId = next.propertyId;
    const f = x.fertilizer;
    if (f && ((next.shop !== undefined && next.shop !== f.shop) || (next.orderedBy !== undefined && next.orderedBy !== f.orderedBy))) {
      // `fertilizer` is one field in a patch, so the whole object is copied with only these two changed.
      patch.fertilizer = { ...f, shop: next.shop ?? f.shop, orderedBy: next.orderedBy ?? f.orderedBy };
    }
    if (Object.keys(patch).length) writes.push({ id: x.id, baseEventId: x.headEventId, patch });
  }
  return writes;
};

/** "ของมาแล้ว": every item → stage `actual` (items already actual are skipped). */
export const deliverOrder = (o: OrderView): OrderPatchWrite[] => patchOrderFields(o, { stage: 'actual' });
