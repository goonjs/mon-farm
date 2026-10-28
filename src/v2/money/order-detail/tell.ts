/**
 * What the order-detail sheets write (E11-S11 FD-3…FD-5), as pure functions: the item's sacks,
 * the `fertilizer` patch for reasons and zones, and the `share` patch for the tappers.
 * Money is never recomputed here — `splitShare` / `checkShare` / `lastLineSacks` are the engine's.
 */

import type { OrderPatchWrite, OrderView } from '../../../core/finance/fert-order';
import { checkFertilizer } from '../../../core/finance/fertilizer';
import type { Expense } from '../../../core/finance/ledger';
import { checkShare, splitShare, type ShareProblem, type SplitResult } from '../../../core/finance/share';
import type { ExpensePatch, ExpenseShare, FertilizerDetails, FertilizerZoneUse, Payer, ShareSettle } from '../../../core/finance/types';
import type { ItemMoney } from '../order/order-model';

/** Sacks of an item: the order item's own, else the legacy share's total. */
export function itemSacks(e: Expense): number {
  return e.fertilizer?.sacks ?? e.share?.totalSacks ?? e.line?.qty ?? 0;
}

/** The item's price before any discount — the bill the share splits. */
export function itemGross(e: Expense): number {
  return e.line?.grossSatang ?? e.share?.billSatang ?? (e.amountSatang ?? 0) + (e.discountSatang ?? 0);
}

/** All discount on the item: item + its bill share. A legacy item keeps it only inside its share. */
export function itemDiscountTotal(e: Expense): number {
  return e.discountSatang ?? e.share?.discountSatang ?? 0;
}

export interface ZoneInput {
  readonly zoneId: string;
  readonly zoneName: string;
  readonly sacks: number;
}

/** Zones with sacks > 0, keeping a zone's old per-zone reasons and note. */
export function buildZones(e: Expense, inputs: readonly ZoneInput[]): FertilizerZoneUse[] {
  const old = new Map((e.fertilizer?.zones ?? []).map((z) => [z.zoneId, z]));
  return inputs
    .filter((z) => z.sacks > 0)
    .map((z) => ({ zoneId: z.zoneId, zoneName: z.zoneName, sacks: z.sacks, reasons: old.get(z.zoneId)?.reasons ?? [], note: old.get(z.zoneId)?.note ?? '' }));
}

/** Reasons chosen for the item; a zone's own reasons that are no longer chosen are dropped (checkFertilizer 'zone-reason-unknown'). */
export function reasonsPatch(e: Expense, reasons: readonly string[]): ExpensePatch {
  const f = e.fertilizer as FertilizerDetails;
  const keep = new Set(reasons);
  return { fertilizer: { ...f, reasons, zones: f.zones.map((z) => ({ ...z, reasons: z.reasons.filter((r) => keep.has(r)) })) } };
}

export function zonesPatch(e: Expense, inputs: readonly ZoneInput[], farmId: string | null): ExpensePatch {
  const f = e.fertilizer as FertilizerDetails;
  const zones = buildZones(e, inputs);
  // The item follows the farm its zones were saved for; with no zones it keeps its own farm.
  return { fertilizer: { ...f, zones }, ...(zones.length && farmId && e.propertyId !== farmId ? { propertyId: farmId } : {}) };
}

/** null = "not shared" (a decision, `share: null`). */
export interface TapperInput {
  readonly worker: Payer;
  readonly sacks: number;
  readonly pct: number;
  readonly settle: ShareSettle;
}

export function buildShare(e: Expense, lines: readonly TapperInput[]): ExpenseShare {
  return {
    billSatang: itemGross(e),
    discountSatang: itemDiscountTotal(e),
    totalSacks: itemSacks(e),
    lines: lines.map((l) => ({ worker: l.worker, sacks: l.sacks, workerPct: l.pct, settle: l.settle })),
  };
}

/** The share and the net amount always travel together, so a concurrent edit conflicts on both or neither. */
export function tapperPatch(e: Expense, lines: readonly TapperInput[] | null): ExpensePatch {
  return { share: lines === null ? null : buildShare(e, lines), amountSatang: e.amountSatang };
}

export function tapperProblems(e: Expense, lines: readonly TapperInput[]): ShareProblem[] {
  return checkShare(buildShare(e, lines));
}

export function tapperSplit(e: Expense, lines: readonly TapperInput[]): SplitResult | null {
  const share = buildShare(e, lines);
  return checkShare(share).length ? null : splitShare(share);
}

export function zoneProblems(e: Expense, inputs: readonly ZoneInput[]) {
  return checkFertilizer({ ...(e.fertilizer as FertilizerDetails), zones: buildZones(e, inputs) }, itemSacks(e));
}

// ─── Edit an item (quantity, price, item discount) ─────────────────────────────

/** Satang per unit, half up, in integers (same rule as the order builder). */
const roundedPer = (gross: number, qty: number) => Math.floor((2 * gross + qty) / (2 * qty));

/** The item's own discount (not the bill share): from its line, else a legacy item's whole discount. */
const ownDiscount = (e: Expense): number => (e.line ? e.line.itemDiscountSatang : itemDiscountTotal(e));

export interface EditProblems {
  /** Sacks already given to tappers (> new qty). */
  readonly tappers?: number;
  /** Sacks already placed in zones (> new qty). */
  readonly zones?: number;
  /** Item discount plus the bill share exceeds the new price. */
  readonly discount?: true;
}

export function editItemProblems(e: Expense, m: ItemMoney): EditProblems {
  const qty = m.qty ?? 0;
  const out: { -readonly [K in keyof EditProblems]: EditProblems[K] } = {};
  if (e.fertilizer || e.share) {
    const given = (e.share?.lines ?? []).reduce((s, l) => s + (l.sacks ?? 0), 0);
    const placed = (e.fertilizer?.zones ?? []).reduce((s, z) => s + z.sacks, 0);
    if (qty < given) out.tappers = given;
    if (qty < placed) out.zones = placed;
  }
  const billShare = itemDiscountTotal(e) - ownDiscount(e);
  if ((m.gross ?? 0) < m.discount + billShare) out.discount = true;
  return out;
}

/** One patch: amount, discount, line, fertilizer sacks/price and an existing share, so they conflict together or not at all. */
export function editItemPatch(e: Expense, m: ItemMoney, unit: string): ExpensePatch {
  const qty = m.qty ?? 0;
  const gross = m.gross ?? 0;
  const discountSatang = m.discount + (itemDiscountTotal(e) - ownDiscount(e));
  const f = e.fertilizer;
  return {
    amountSatang: gross - discountSatang,
    discountSatang,
    line: { qty, unit, grossSatang: gross, itemDiscountSatang: m.discount },
    ...(f ? { fertilizer: { ...f, sacks: qty, pricePerSackSatang: roundedPer(gross, qty), itemDiscountSatang: m.discount } } : {}),
    ...(e.share ? { share: { ...e.share, billSatang: gross, discountSatang, totalSacks: qty } } : {}),
  };
}

/** "ใช้ค่านี้กับทุกรายการ": the order's own date, stage and payer on every item that differs (a planned order stays planned). */
export function unifyOrder(o: OrderView): OrderPatchWrite[] {
  const writes: OrderPatchWrite[] = [];
  for (const x of o.items) {
    const patch: { -readonly [K in keyof ExpensePatch]: ExpensePatch[K] } = {};
    if (x.date !== o.date) patch.date = o.date;
    if (x.stage !== o.stage) patch.stage = o.stage;
    if ((x.payer?.id ?? null) !== (o.payer?.id ?? null)) patch.payer = o.payer;
    if (Object.keys(patch).length) writes.push({ id: x.id, baseEventId: x.headEventId, patch });
  }
  return writes;
}
