/**
 * The one-time check against the buyer (E05-S03 · D-72 · SET-6).
 *
 * Stored in the finance log, keyed by sale, like the rounding choice — the
 * sale log stays untouched (additive only). The check remembers the figures
 * it was made against (`basis`); when our figures move afterwards (a basket
 * voided, one synced in late, a price change for a total check) the result
 * stops counting and the sale reads "รอตรวจสอบเทียบยอด" again, flagged so
 * someone checks it once more. Nothing is written for that: it is derived.
 */

import type { Settlement } from '../settle';
import { basketNetG, liveBaskets } from '../totals';
import type { SaleEvent, SaleState } from '../types';
import { headsOf } from './ledger';
import type { BuyerCheckStatus, BuyerFigures, FinanceEvent, FinancePayload, SaleFigures } from './types';

export type { BuyerCheckStatus, BuyerFigures, SaleFigures } from './types';

export interface BuyerCheck {
  /** What the sale shows now. */
  readonly status: BuyerCheckStatus;
  /** The last recorded result, even when it no longer holds; null when none or undone. */
  readonly recorded: Exclude<BuyerCheckStatus, 'pending'> | null;
  /** A recorded result our figures have since moved away from. */
  readonly stale: boolean;
  /** Two phones recorded different results; held at pending until someone picks. */
  readonly conflict: boolean;
  readonly head: string | null;
  readonly heads: readonly string[];
  readonly basis: SaleFigures;
  readonly buyer: BuyerFigures | null;
  /** buyer − ours per figure the buyer gave; null when not given. */
  readonly diff: { readonly netG: number | null; readonly grossSatang: number | null; readonly baskets: number | null } | null;
  readonly reason: string;
}

type CheckPayload = Extract<FinancePayload, { t: 'buyer_check_set' }>;

export const buyerCheckTarget = (saleId: string) => `buyer-check-${saleId}`;

export function buyerCheckPayload(
  saleId: string,
  status: BuyerCheckStatus,
  ours: SaleFigures,
  buyer: BuyerFigures | null = null,
  reason = '',
): CheckPayload {
  // The rule lives here, not only in the form: "พบส่วนต่าง" always has a reason (review #1).
  if (checkBuyerCheck(status, reason, buyer).length) throw new RangeError('buyer check: a difference needs a reason and whole, non-negative figures');
  // "ตรงกันทั้งหมด" records the buyer's figures as ours in the same tap (D-72).
  const given = status === 'total' ? { netG: ours.netG, grossSatang: ours.grossSatang, baskets: ours.baskets } : buyer;
  return { t: 'buyer_check_set', saleId, status, basis: ours, buyer: given, reason: reason.trim() };
}

/** What stops a check from being saved. */
export function checkBuyerCheck(status: BuyerCheckStatus, reason: string, buyer: BuyerFigures | null): ('reason' | 'buyer')[] {
  const out: ('reason' | 'buyer')[] = [];
  if (status === 'diff' && !reason.trim()) out.push('reason');
  if (buyer && [buyer.netG, buyer.grossSatang, buyer.baskets].some((v) => v !== null && (!Number.isInteger(v) || v < 0))) out.push('buyer');
  return out;
}

const sameWeight = (a: SaleFigures, b: SaleFigures) => a.netG === b.netG && a.baskets === b.baskets;
const sameTotal = (a: SaleFigures, b: SaleFigures) => sameWeight(a, b) && a.grossSatang === b.grossSatang && a.satangPerKg === b.satangPerKg;
const sameResult = (a: CheckPayload, b: CheckPayload) => a.status === b.status && JSON.stringify(a.buyer) === JSON.stringify(b.buyer) && a.reason === b.reason;

export function buyerCheck(events: readonly FinanceEvent[], saleId: string, ours: SaleFigures): BuyerCheck {
  const target = buyerCheckTarget(saleId);
  const mine = events.filter((e) => e.targetId === target && e.payload.t === 'buyer_check_set');
  const heads = headsOf(mine, target);
  const empty: BuyerCheck = { status: 'pending', recorded: null, stale: false, conflict: false, head: null, heads, basis: ours, buyer: null, diff: null, reason: '' };
  if (!heads.length) return empty;

  const payloads = heads.map((id) => mine.find((e) => e.id === id)!.payload as CheckPayload);
  const head = heads[heads.length - 1];
  if (payloads.some((p) => !sameResult(p, payloads[0]))) return { ...empty, conflict: true, head };

  const p = payloads[payloads.length - 1];
  if (p.status === 'pending') return { ...empty, head };

  // Every merged head must still hold, not just the one that sorts last (review #5).
  const holds = payloads.every((x) => (x.status === 'weight' ? sameWeight(x.basis, ours) : sameTotal(x.basis, ours)));
  const gap = (b: number | null | undefined, o: number) => (b === null || b === undefined ? null : b - o);
  return {
    status: holds ? p.status : 'pending',
    recorded: p.status,
    stale: !holds,
    conflict: false,
    head,
    heads,
    basis: p.basis,
    buyer: p.buyer,
    diff: p.buyer ? { netG: gap(p.buyer.netG, p.basis.netG), grossSatang: gap(p.buyer.grossSatang, p.basis.grossSatang), baskets: gap(p.buyer.baskets, p.basis.baskets) } : null,
    reason: p.reason,
  };
}

// ── Our side, from the recorded baskets ─────────────────────────────────────

/** Our figures for the check, straight from the settlement (D-15). */
export function saleFigures(s: Settlement): SaleFigures {
  return { netG: s.totals.netG, satangPerKg: s.satangPerKg, grossSatang: s.grossSatang, baskets: s.totals.baskets };
}

/** "เข่งไม่เต็ม … กก.", broken down by zone; zones without any are left out. */
export function shortByZone(s: Settlement): { zoneId: string; zoneName: string; baskets: number; netG: number }[] {
  return s.perZone
    .filter((z) => z.totals.shortBaskets > 0)
    .map((z) => ({ zoneId: z.zoneId, zoneName: z.zoneName, baskets: z.totals.shortBaskets, netG: z.totals.shortNetG }));
}

export interface DrillPile {
  readonly pileId: string;
  readonly name: string;
  readonly netG: number;
  readonly baskets: readonly { readonly id: string; readonly netG: number; readonly short: boolean }[];
}

export interface DrillZone {
  readonly zoneId: string;
  readonly name: string;
  readonly piles: readonly DrillPile[];
}

/** Sale → zone → pile → basket (SET-3). Only live baskets: voided and deleted ones are not money. */
export function drillDown(events: readonly SaleEvent[], state: SaleState): DrillZone[] {
  const live = liveBaskets(events);
  return state.zones.map((z) => ({
    zoneId: z.id,
    name: z.name,
    piles: state.piles
      .filter((p) => p.zoneId === z.id)
      .map((p) => {
        const baskets = live.filter((b) => b.pileId === p.id).map((b) => ({ id: b.id, netG: basketNetG(b), short: b.kind === 'short' }));
        return { pileId: p.id, name: p.name, netG: baskets.reduce((sum, b) => sum + b.netG, 0), baskets };
      }),
  }));
}
