/**
 * Pure helpers of the order capture screen (E11-S11 "ใบซื้อ"): the shape one item sheet edits, turning it into an
 * `OrderLineDraft`, the products and shops offered from past purchases, and the repeat-order prefill. No React, no storage.
 * The rules (totals, checks, discount split) live in `core/finance/fert-order.ts`; nothing here re-derives them.
 */

import { fertProducts, type FertProduct } from '../../../core/finance/fert-products';
import { FERTILIZER_CATEGORY, type OrderLineDraft, type OrderView } from '../../../core/finance/fert-order';
import type { Expense, FertOption } from '../../../core/finance/ledger';
import type { FertilizerType } from '../../../core/finance/types';

export const SACK_UNIT_KEY = 'ordc.sackUnit';

/** What an item is, before it has a quantity or a price. */
export interface ProductSpec {
  readonly categoryId: string;
  /** What the list shows: formula (+ brand), or the typed name. */
  readonly item: string;
  readonly unit: string;
  /** Present exactly for fertilizer. */
  readonly fertilizer?: { readonly type: FertilizerType; readonly formula: string; readonly brand: string; readonly sackKg: number | null };
}

/** The number state of one item sheet. `unitPrice` set = the per-unit price was typed last (gross follows qty × price); null = the typed total is the source. */
export interface ItemMoney {
  readonly qty: number | null;
  readonly unitPrice: number | null;
  readonly gross: number | null;
  readonly discount: number;
  readonly mode: 'per' | 'total';
}

export const EMPTY_MONEY: ItemMoney = { qty: null, unitPrice: null, gross: null, discount: 0, mode: 'per' };

/** A line id that sorts in entry order (groupOrders sorts items by expense id = orderId-lineId): zero-padded position, then a random tail. */
export const lineIdAt = (index: number, rand: () => string): string => `li-${String(index).padStart(3, '0')}-${rand()}`;
/** The next position after the ones already used by `ids` (removals never reuse a position). */
export function nextLineId(ids: readonly string[], rand: () => string): string {
  const used = ids.map((i) => Number(/^li-(\d+)-/.exec(i)?.[1] ?? -1));
  return lineIdAt(Math.max(-1, ...used) + 1, rand);
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export const productName = (formula: string, brand: string) => (brand.trim() ? `${formula.trim()} ${brand.trim()}` : formula.trim());

export function fertSpec(p: { type: FertilizerType; formula: string; brand: string; sackKg: number | null }, sackUnit: string): ProductSpec {
  return {
    categoryId: FERTILIZER_CATEGORY,
    item: productName(p.formula, p.brand),
    unit: sackUnit,
    fertilizer: { type: p.type, formula: p.formula.trim(), brand: p.brand.trim(), sackKg: p.sackKg },
  };
}

/** Per-unit price rounded to the satang (display only; gross stays the source of truth). */
export const perUnit = (gross: number, qty: number): number => Math.round(gross / qty);

/** Applies a quantity: when a unit price was typed, gross follows it. */
export const withQty = (m: ItemMoney, qty: number): ItemMoney => ({ ...m, qty, gross: m.unitPrice !== null ? qty * m.unitPrice : m.gross });
export const withUnitPrice = (m: ItemMoney, price: number): ItemMoney => ({ ...m, unitPrice: price, gross: m.qty ? m.qty * price : null });
/** Switching the price mode: total keeps the typed gross and drops the unit price (so a new quantity no longer overwrites it); per-unit derives the price only when gross is an exact multiple. */
export function withMode(m: ItemMoney, mode: ItemMoney['mode']): ItemMoney {
  if (mode === 'total') return { ...m, mode, unitPrice: null };
  const per = m.gross !== null && m.qty ? perUnit(m.gross, m.qty) : null;
  const exact = per !== null && m.qty !== null && per * m.qty === m.gross;
  return { ...m, mode, unitPrice: exact ? per : null };
}
export const withGross = (m: ItemMoney, gross: number): ItemMoney => ({ ...m, unitPrice: null, gross });

/** The money state an existing line starts the sheet with: per-unit when the gross is an exact multiple, else the total. */
export function moneyOfLine(l: Pick<OrderLineDraft, 'qty' | 'grossSatang' | 'itemDiscountSatang'>): ItemMoney {
  const per = l.qty > 0 ? perUnit(l.grossSatang, l.qty) : 0;
  const exact = per * l.qty === l.grossSatang;
  return { qty: l.qty, unitPrice: exact ? per : null, gross: l.grossSatang, discount: l.itemDiscountSatang, mode: exact ? 'per' : 'total' };
}

export function specOfLine(l: OrderLineDraft): ProductSpec {
  return { categoryId: l.categoryId, item: l.item, unit: l.unit, ...(l.fertilizer ? { fertilizer: l.fertilizer } : {}) };
}

export interface MoneyProblems {
  readonly qty: boolean;
  readonly price: boolean;
  readonly discount: boolean;
}

export function moneyProblems(m: ItemMoney): MoneyProblems {
  const gross = m.gross ?? 0;
  return {
    qty: !(m.qty !== null && Number.isSafeInteger(m.qty) && m.qty >= 1),
    price: !(m.gross !== null && Number.isSafeInteger(gross) && gross > 0),
    discount: m.discount > gross,
  };
}

export const moneyOk = (p: MoneyProblems) => !p.qty && !p.price && !p.discount;

export function lineOf(id: string, spec: ProductSpec, m: ItemMoney): OrderLineDraft {
  return {
    id,
    categoryId: spec.categoryId,
    item: spec.item.trim(),
    ...(spec.fertilizer ? { fertilizer: spec.fertilizer } : {}),
    qty: m.qty ?? 0,
    unit: spec.unit,
    grossSatang: m.gross ?? 0,
    itemDiscountSatang: m.discount,
  };
}

const newestFirst = (a: Expense, b: Expense) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.id < b.id ? 1 : -1);

/**
 * Products bought before (E11-S10 `fertProducts`) with the last per-sack price read from order items
 * (`fertilizer.pricePerSackSatang`) when the product was last bought on an order.
 */
export function pastProducts(expenses: readonly Expense[], options: readonly FertOption[]): FertProduct[] {
  const live = expenses.filter((e) => !e.deleted && e.fertilizer).sort(newestFirst);
  return fertProducts(expenses, options).map((p) => {
    const hit = live.find((e) => {
      const f = e.fertilizer!;
      return f.pricePerSackSatang !== undefined && [f.type, norm(f.formula), norm(f.brand), f.sackKg ?? ''].join('|') === p.key;
    });
    return hit ? { ...p, lastPerSackSatang: hit.fertilizer!.pricePerSackSatang! } : p;
  });
}

/** Distinct non-empty values of a fertilizer field over past purchases, newest first. */
export function recentFertValues(expenses: readonly Expense[], field: 'shop' | 'orderedBy', limit = 6): string[] {
  const out: string[] = [];
  for (const e of [...expenses].filter((x) => !x.deleted && x.fertilizer).sort(newestFirst)) {
    const v = e.fertilizer![field].trim();
    if (v && !out.some((o) => norm(o) === norm(v))) out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

/** "สั่งซ้ำ": the same items, quantities and unit prices; item discounts and the bill discount are not carried. */
export function repeatLines(order: OrderView, rand: () => string, sackUnit: string, pieceUnit: string): OrderLineDraft[] {
  return order.items.map((e, index) => {
    const f = e.fertilizer;
    // Order items store their own line (qty, unit, gross); older expenses fall back to what they kept.
    const qty = e.line?.qty ?? (f ? (f.sacks ?? e.share?.totalSacks ?? 1) : 1);
    const gross = e.line?.grossSatang ?? (f?.pricePerSackSatang !== undefined && f.sacks ? f.pricePerSackSatang * f.sacks : (e.amountSatang ?? 0) + (e.discountSatang ?? 0));
    return {
      id: lineIdAt(index, rand),
      categoryId: e.categoryId ?? 'cat-other',
      item: e.item,
      ...(f ? { fertilizer: { type: f.type, formula: f.formula, brand: f.brand, sackKg: f.sackKg } } : {}),
      qty,
      unit: e.line?.unit ?? (f ? sackUnit : pieceUnit),
      grossSatang: gross,
      itemDiscountSatang: 0,
    };
  });
}
