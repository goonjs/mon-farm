/**
 * What the v2 home shows about sales (flow-v1 screen 3, "วันนี้ต้องรู้อะไรบ้าง"
 * / v1.1.0 "ควรรู้ / ควรจัดการ"): the sale still being weighed, if any, and
 * the most recent finished one. Pure — the screen hands in each sale's log.
 *
 * Deleted sales are hidden (SYNC-10) and cancelled ones count in no total
 * across sales (E04-S11), so neither is shown.
 */

import { projectSale } from './project';
import { statusCountsAsClosed } from './sale-status';
import { saleTotals } from './totals';
import type { SaleEvent } from './types';

export interface SaleLine {
  readonly id: string;
  /** When the sale started; the first event's time for a log without a start. */
  readonly ts: number | null;
  readonly netG: number;
  readonly baskets: number;
}

export interface HomeSales {
  /** The newest sale not yet finished. */
  readonly open: SaleLine | null;
  /** The newest finished (completed or closed) sale. */
  readonly latest: SaleLine | null;
}

export function homeSales(sales: readonly { id: string; events: readonly SaleEvent[] }[]): HomeSales {
  let open: SaleLine | null = null;
  let latest: SaleLine | null = null;
  const newer = (a: SaleLine, b: SaleLine | null) => !b || (a.ts ?? 0) > (b.ts ?? 0);
  for (const { id, events } of sales) {
    const state = projectSale(events, id);
    if (state.deleted || state.saleStatus === 'cancelled') continue;
    const totals = saleTotals(events);
    const line: SaleLine = { id, ts: state.startedTs ?? events[0]?.ts ?? null, netG: totals.netG, baskets: totals.baskets };
    if (statusCountsAsClosed(state)) {
      if (newer(line, latest)) latest = line;
    } else if (newer(line, open)) {
      open = line;
    }
  }
  return { open, latest };
}
