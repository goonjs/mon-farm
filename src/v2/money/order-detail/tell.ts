/**
 * What the order-detail sheets write (E11-S11 FD-3…FD-5), as pure functions: the item's sacks,
 * the `fertilizer` patch for reasons and zones, and the `share` patch for the tappers.
 * Money is never recomputed here — `splitShare` / `checkShare` / `lastLineSacks` are the engine's.
 */

import { checkFertilizer } from '../../../core/finance/fertilizer';
import type { Expense } from '../../../core/finance/ledger';
import { checkShare, splitShare, type ShareProblem, type SplitResult } from '../../../core/finance/share';
import type { ExpensePatch, ExpenseShare, FertilizerDetails, FertilizerZoneUse, Payer, ShareSettle } from '../../../core/finance/types';

/** Sacks of an item: the order item's own, else the legacy share's total. */
export function itemSacks(e: Expense): number {
  return e.fertilizer?.sacks ?? e.share?.totalSacks ?? e.line?.qty ?? 0;
}

/** The item's price before any discount — the bill the share splits. */
export function itemGross(e: Expense): number {
  return e.line?.grossSatang ?? e.share?.billSatang ?? (e.amountSatang ?? 0) + (e.discountSatang ?? 0);
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
  return { fertilizer: { ...f, zones }, ...(zones.length && e.propertyId === null && farmId ? { propertyId: farmId } : {}) };
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
    discountSatang: e.discountSatang ?? 0,
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
