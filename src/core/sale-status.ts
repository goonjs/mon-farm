/**
 * A sale's business status (E04-S11, SALE-20/21): Draft → Completed (only
 * once a price is set, owner 2026-10-03) or Draft → Cancelled. Completed can
 * still be edited directly (D-16); an edit that changes money asks why and
 * flags the payment for a recheck. Cancelled is not Soft Delete (SYNC-10):
 * the sale stays listed with its baskets, and counts in no total across sales.
 */

import { compareEvents } from './order';
import type { SaleEvent, SaleState } from './types';

/** The owner's preset reasons; "อื่นๆ" is typed (owner 2026-10-03). */
export const MONEY_REASONS = ['ชั่งผิด', 'ราคาผิด', 'ผู้ซื้อแจ้งยอดต่าง'] as const;

export function canComplete(sale: SaleState): boolean {
  return sale.saleStatus === 'draft' && sale.price !== null;
}

/**
 * Whether a finished sale counts as closed for what comes after it (a new
 * tapper share starts after the last one, D-63). Completed or the older
 * `sale_closed` count; Cancelled never does.
 */
export function statusCountsAsClosed(sale: SaleState): boolean {
  if (sale.saleStatus === 'cancelled') return false;
  return sale.saleStatus === 'completed' || sale.status === 'closed';
}

const MONEY_SYS = new Set(['price_set', 'split_set', 'zone_contract_set', 'zone_contract_cleared', 'deduction_added', 'deduction_voided']);

/** Whether recording this would change a tapper's total, the owner's share or the sale total. */
export function isMoneyChange(e: { kind: string; payload?: { t: string } }): boolean {
  if (e.kind === 'accept' || e.kind === 'short' || e.kind === 'correction' || e.kind === 'delete' || e.kind === 'restore') return true;
  return e.kind === 'sys' && !!e.payload && MONEY_SYS.has(e.payload.t);
}

/** Money edits recorded after the sale was Completed — each one a payment to recheck (E05-S05). */
export function paymentRecheck(events: readonly SaleEvent[]): { reason: string; targetId: string; ts: number }[] {
  const out: { reason: string; targetId: string; ts: number }[] = [];
  for (const e of [...events].sort(compareEvents)) {
    if (e.kind !== 'sys') continue;
    if (e.payload.t === 'money_edit') out.push({ reason: e.payload.reason, targetId: e.payload.targetId, ts: e.ts });
  }
  return out;
}
