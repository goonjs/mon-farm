/**
 * Sale history rows (E05-S06): what each sale says, derived from its own log
 * — buyer, kg, baskets, price, amount, status. The amount comes from
 * `settle()`, never re-computed here, so the history cannot disagree with the
 * settlement screen; a sale `settle()` refuses (no price, no split) shows no
 * amount rather than a guess. Deleted sales leave the list and the totals
 * (SYNC-10). Check/payment statuses join when E05-S03/S05 exist.
 */

import { settle } from '../settle';
import { saleTotals } from '../totals';
import type { OpenClosed, SaleEvent, SaleState } from '../types';
import { projectSale } from '../project';

export interface SaleRow {
  readonly saleId: string;
  /** Wall-clock start, for display only — the list order uses it, no money does. */
  readonly startedTs: number | null;
  readonly buyer: string;
  readonly farmName: string;
  readonly netG: number;
  readonly baskets: number;
  readonly satangPerKg: number | null;
  readonly grossSatang: number | null;
  readonly ownerSatang: number | null;
  readonly status: OpenClosed;
  readonly deleted: boolean;
}

export function summarizeSale(events: readonly SaleEvent[], state: SaleState): SaleRow {
  const totals = saleTotals(events);
  let grossSatang: number | null = null;
  let ownerSatang: number | null = null;
  try {
    const s = settle(events, state);
    grossSatang = s.grossSatang;
    ownerSatang = s.ownerSatang;
  } catch {
    // No price or no split yet: show no amount rather than invent one.
  }
  return {
    saleId: state.id,
    startedTs: state.startedTs,
    buyer: state.parties?.buyer ?? '',
    farmName: state.parties?.farmName ?? '',
    netG: totals.netG,
    baskets: totals.baskets,
    satangPerKg: state.price?.satangPerKg ?? null,
    grossSatang,
    ownerSatang,
    status: state.status,
    deleted: state.deleted,
  };
}

export function saleHistory(sales: readonly { id: string; events: readonly SaleEvent[] }[]) {
  const rows = sales.map((s) => summarizeSale(s.events, projectSale(s.events, s.id)));
  const visible = rows.filter((r) => !r.deleted).sort((a, b) => (b.startedTs ?? 0) - (a.startedTs ?? 0));
  return {
    visible,
    deletedCount: rows.length - visible.length,
    totalSatang: visible.reduce((s, r) => s + (r.grossSatang ?? 0), 0),
    totalNetG: visible.reduce((s, r) => s + r.netG, 0),
    /** Sales with no amount yet — counted, but not in `totalSatang` (review #9). */
    unpricedCount: visible.filter((r) => r.grossSatang === null).length,
  };
}
