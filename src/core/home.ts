/**
 * What the v2 home shows about sales (flow-v1 screen 3, "วันนี้ต้องรู้อะไรบ้าง"
 * / v1.1.0 "ควรรู้ / ควรจัดการ"): the sale still being weighed, if any, and
 * the most recent finished one. Pure — the screen hands in each sale's log.
 *
 * Deleted sales are hidden (SYNC-10) and cancelled ones count in no total
 * across sales (E04-S11), so neither is shown.
 */

import { currentPoint } from './sale-list';
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
  /** A pile is being counted right now ("กำลังชั่ง"), not just open. */
  readonly weighing: boolean;
  /** Where the sale was last weighing — the home opens it there (v2 sale flow). */
  readonly point: string | null;
}

export interface HomeSales {
  /** The newest sale not yet finished. */
  readonly open: SaleLine | null;
  /** The newest finished (completed or closed) sale. */
  readonly latest: SaleLine | null;
}

/** One sale as a home row, and whether it counts as closed; null when it is deleted or cancelled. */
export function saleLineOf(id: string, events: readonly SaleEvent[]): { line: SaleLine; closed: boolean } | null {
  const state = projectSale(events, id);
  if (state.deleted || state.saleStatus === 'cancelled') return null;
  const totals = saleTotals(events);
  return {
    line: {
      id,
      ts: state.startedTs ?? events[0]?.ts ?? null,
      netG: totals.netG,
      baskets: totals.baskets,
      weighing: state.piles.some((p) => p.status === 'counting'),
      point: currentPoint(events),
    },
    closed: statusCountsAsClosed(state),
  };
}

export function homeSales(sales: readonly { id: string; events: readonly SaleEvent[] }[]): HomeSales {
  let open: SaleLine | null = null;
  let latest: SaleLine | null = null;
  const newer = (a: SaleLine, b: SaleLine | null) => !b || (a.ts ?? 0) > (b.ts ?? 0);
  for (const { id, events } of sales) {
    const one = saleLineOf(id, events);
    if (!one) continue;
    if (one.closed) {
      if (newer(one.line, latest)) latest = one.line;
    } else if (newer(one.line, open)) {
      open = one.line;
    }
  }
  return { open, latest };
}
