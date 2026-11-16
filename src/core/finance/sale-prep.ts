/**
 * E15-S01 · the sale prep checklist (เตรียมการขาย, owner 2026-11-17 "ก · ก · โอเค ทำตามนี้"):
 * who buys, which day (and an optional time), the agreed price, and fertilizer split to the tappers.
 * A help to prepare, never a gate (PREP-9). Pure core: no react, no clock.
 */

import type { FinanceEvent, Payer, SalePrepPatch } from './types';

/** The one prep's record (PREP-8: one at a time). */
export const SALE_PREP_TARGET = 'sale-prep';

export interface SalePrep {
  readonly buyerId: string | null;
  readonly buyerName: string;
  readonly date: string | null;
  readonly time: string | null;
  readonly priceSatangPerKg: number | null;
  /** Wall clock of the last write, display only: a sale started after it has used this prep. */
  readonly updatedTs: number;
}

const EMPTY: Omit<SalePrep, 'updatedTs'> = { buyerId: null, buyerName: '', date: null, time: null, priceSatangPerKg: null };

/**
 * The current prep, or null when there is none (never set, or cancelled). Patches apply in log order, each
 * replacing only the fields it carries, so writes of different rows from two phones both stay.
 */
export function salePrep(events: readonly FinanceEvent[]): SalePrep | null {
  let cur: SalePrep | null = null;
  for (const e of events) {
    if (e.payload.t !== 'sale_prep_set') continue;
    const patch: SalePrepPatch = e.payload.patch;
    if (patch.cancelled) {
      cur = null;
      continue;
    }
    const base: SalePrep = cur ?? { ...EMPTY, updatedTs: e.ts };
    cur = {
      buyerId: patch.buyerId !== undefined ? patch.buyerId : base.buyerId,
      buyerName: patch.buyerName !== undefined ? patch.buyerName : base.buyerName,
      date: patch.date !== undefined ? patch.date : base.date,
      time: patch.time !== undefined ? patch.time : base.time,
      priceSatangPerKg: patch.priceSatangPerKg !== undefined ? patch.priceSatangPerKg : base.priceSatangPerKg,
      updatedTs: Math.max(base.updatedTs, e.ts),
    };
  }
  return cur;
}

/** How many of the 4 rows are still open: buyer, date, price, and fertilizer left to split. The time never counts. */
export function prepLeft(prep: SalePrep | null, unsplit: number): number {
  return [!prep?.buyerId, !prep?.date, prep?.priceSatangPerKg == null, unsplit > 0].filter(Boolean).length;
}

export interface PrepDebtInput {
  readonly worker: Payer;
  readonly amountSatang: number;
  readonly date: string;
  readonly deleted: boolean;
}

/**
 * New fertilizer debt per tapper (PREP-7): live lumps dated after the last sale's day (all of them before any
 * sale), summed per tapper, largest first. Only to show what the sale will have to deduct; it sets nothing.
 */
export function newFertDebts(debts: readonly PrepDebtInput[], lastSaleDay: string | null): { worker: Payer; satang: number }[] {
  const by = new Map<string, { worker: Payer; satang: number }>();
  for (const d of debts) {
    if (d.deleted || d.amountSatang <= 0 || (lastSaleDay !== null && d.date <= lastSaleDay)) continue;
    const row = by.get(d.worker.id) ?? { worker: d.worker, satang: 0 };
    row.satang += d.amountSatang;
    by.set(d.worker.id, row);
  }
  return [...by.values()].sort((a, b) => b.satang - a.satang || (a.worker.name < b.worker.name ? -1 : 1));
}
