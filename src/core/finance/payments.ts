/**
 * Separate payment statuses (E05-S05 · SET-6), replacing one "Paid" flag:
 * each worker's cash and the owner's transfer is ticked on its own, by
 * whoever handed it over, on whichever phone. Who, when and which device
 * come from the event envelope. A tick remembers the amount it was made at;
 * when that payee's amount changes afterwards (an edit after the sale was
 * completed), the tick stands but is flagged "ต้องตรวจใหม่" (SALE-21).
 */

import type { Actor } from '../types';
import { headsOf } from './ledger';
import type { FinanceEvent, FinancePayload } from './types';

type MarkPayload = Extract<FinancePayload, { t: 'payment_mark_set' }>;

/** The payee id for the owner's transfer. */
export const OWNER_PAYEE = 'owner';

export const paymentTarget = (saleId: string, payee: string) => `payment-${saleId}-${payee}`;

export function paymentMarkPayload(saleId: string, payee: string, done: boolean, amountSatang: number): MarkPayload {
  return { t: 'payment_mark_set', saleId, payee, done, amountSatang };
}

export interface PaymentStatus {
  readonly done: boolean;
  /** The amount it was ticked at; null when never ticked. */
  readonly amountAtMarkSatang: number | null;
  /** Ticked, but the amount has changed since. */
  readonly recheck: boolean;
  /** Ticked on one phone and unticked on another; nothing counts as paid until someone picks. */
  readonly conflict: boolean;
  readonly head: string | null;
  readonly heads: readonly string[];
  readonly by: Actor | null;
  readonly at: number | null;
}

export function paymentStatus(events: readonly FinanceEvent[], saleId: string, payee: string, amountSatang: number): PaymentStatus {
  const target = paymentTarget(saleId, payee);
  const mine = events.filter((e) => e.targetId === target && e.payload.t === 'payment_mark_set');
  const heads = headsOf(mine, target);
  if (!heads.length) return { done: false, amountAtMarkSatang: null, recheck: false, conflict: false, head: null, heads, by: null, at: null };

  const evs = heads.map((id) => mine.find((e) => e.id === id)!);
  const head = heads[heads.length - 1];
  const last = evs[evs.length - 1];
  const p = last.payload as MarkPayload;
  if (evs.some((e) => (e.payload as MarkPayload).done !== p.done)) {
    return { done: false, amountAtMarkSatang: null, recheck: false, conflict: true, head, heads, by: null, at: null };
  }
  return {
    done: p.done,
    amountAtMarkSatang: p.done ? p.amountSatang : null,
    recheck: p.done && p.amountSatang !== amountSatang,
    conflict: false,
    head,
    heads,
    by: last.actor,
    at: last.ts,
  };
}

/** Payees of a sale whose tick is in conflict — the sale cannot be closed until they are settled. */
export function salePaymentConflicts(events: readonly FinanceEvent[], saleId: string): string[] {
  const payees = new Set<string>();
  for (const e of events) if (e.payload.t === 'payment_mark_set' && e.payload.saleId === saleId) payees.add(e.payload.payee);
  return [...payees].filter((p) => paymentStatus(events, saleId, p, 0).conflict).sort();
}
