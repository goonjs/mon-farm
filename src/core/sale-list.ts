/**
 * The sale list and where a sale stands (v2 sale flow, mockup v1.1.0 page 4):
 * pure folds over each sale's log plus farm master data.
 */

import { todayIso, type MasterState } from './master';
import { compareEvents } from './order';
import { projectSale } from './project';
import { saleRollup } from './sale-points';
import { statusCountsAsClosed } from './sale-status';
import type { SaleEvent, SaleState } from './types';

/** The sale's own day: the Bangkok day it started, else today (`now`). */
/** The sale's day: the one picked at the start (E04-S19 BF-9), else the Bangkok day it started. */
export function saleDay(startedTs: number | null, now: number, day?: string | null): string {
  return day ?? todayIso(startedTs ?? now);
}

export interface SaleListRow {
  readonly id: string;
  readonly state: SaleState;
  readonly startedTs: number | null;
  /** The sale day, YYYY-MM-DD (E04-S19): what the list shows and sorts on. */
  readonly day: string;
  readonly buyer: string;
  readonly baskets: number;
  readonly netG: number;
  /** Completed (or the older `sale_closed`), not Cancelled. */
  readonly closed: boolean;
  /** Each tapper's kg in this sale, in the order they first weighed (D-78). */
  readonly tappers: readonly { id: string; name: string; netG: number }[];
  /** Weighed at points with no tapper that day (D-63). */
  readonly unassignedG: number;
}

/** Started, not deleted sales, newest first. */
export function saleListRows(sales: readonly { id: string; events: readonly SaleEvent[] }[], master: MasterState): SaleListRow[] {
  const rows: SaleListRow[] = [];
  for (const { id, events } of sales) {
    const state = projectSale(events, id);
    if (state.deleted || !state.parties) continue;
    const day = saleDay(state.startedTs, 0, state.day);
    const rollup = saleRollup(events, master, day);
    rows.push({
      id,
      state,
      startedTs: state.startedTs,
      day,
      buyer: state.parties.buyer,
      baskets: rollup.sale.baskets,
      netG: rollup.sale.netG,
      closed: statusCountsAsClosed(state),
      tappers: [...rollup.byTapper].map(([tid, t]) => ({ id: tid, name: master.people.find((p) => p.id === tid)?.name ?? '', netG: t.netG })),
      unassignedG: rollup.unassigned.netG,
    });
  }
  return rows.sort((a, b) => (a.day === b.day ? (b.startedTs ?? 0) - (a.startedTs ?? 0) : a.day < b.day ? 1 : -1));
}

const POINT_STEPS = new Set(['pile_added', 'ready', 'zero_check', 'tare_confirmed', 'skew_accepted', 'scale_wait', 'gate_skipped']);

/** The point the sale was last weighing at — its last basket or point step, in fold order. */
export function currentPoint(events: readonly SaleEvent[]): string | null {
  let point: string | null = null;
  for (const e of [...events].sort(compareEvents)) {
    if ((e.kind === 'accept' || e.kind === 'short') && e.pointId) point = e.pointId;
    if (e.kind === 'sys' && POINT_STEPS.has(e.payload.t) && 'pileId' in e.payload) point = e.payload.pileId;
  }
  return point;
}
