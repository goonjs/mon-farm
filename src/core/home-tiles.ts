/**
 * E15-S06 · the state of the home's เตรียมขาย and เริ่มการขาย tiles (owner 2026-11-17, story
 * docs/stories/e15-s06-home-tiles-state.md). Pure: the screen hands in the prep, the sales' phases and the
 * farm's day; nothing is stored, so going back anywhere changes the tiles back (HT-4).
 *
 * Colours the screen paints from these states: yellow = not complete, blue = inviting / in progress,
 * green = complete, red = money still to pay.
 */

import { prepLeft, type SalePrep } from './finance/sale-prep';
import { todayIso as farmToday } from './master';
import { statusCountsAsClosed } from './sale-status';
import type { FinanceEvent } from './finance/types';
import type { SaleState } from './types';

/** Where one sale is: counting baskets, every pile counted and at the clearing step, or closed. */
export type SalePhase = 'counting' | 'clearing' | 'closed';

/**
 * A sale's phase; null for a deleted or cancelled one. The clearing step has no event of its own (it is a page),
 * so it is read from what that step writes: once the sale's debt deductions or payment ticks are recorded
 * (`clearingStarted`) and no pile is being counted, the sale is at clearing; counting again takes it back (HT-4).
 */
export function salePhase(state: SaleState, clearing: boolean): SalePhase | null {
  if (state.deleted || state.saleStatus === 'cancelled') return null;
  if (statusCountsAsClosed(state)) return 'closed';
  return clearing && !state.piles.some((p) => p.status === 'counting') ? 'clearing' : 'counting';
}

/** Whether the clearing step has written anything for this sale: a debt payment line or a payment tick. */
export function clearingStarted(fin: readonly FinanceEvent[], saleId: string): boolean {
  return fin.some((e) => {
    const p = e.payload;
    return p.t === 'payment_mark_set' ? p.saleId === saleId : p.t === 'debt_payment_recorded' ? p.fields.saleId === saleId : false;
  });
}

/** One sale as the tiles see it. `unpaid` = piles of money still to pay, only meaningful when closed. */
export interface TileSale {
  readonly id: string;
  /** When it started (wall clock). */
  readonly ts: number;
  /** The sale's day, YYYY-MM-DD (Bangkok). */
  readonly day: string;
  readonly phase: SalePhase;
  readonly unpaid: number;
}

export type PrepTile = { readonly state: 'P0' } | { readonly state: 'P1'; readonly left: number } | { readonly state: 'P2' };
export type StartTile = { readonly state: 'S0' | 'S1' | 'S2' | 'S3' | 'S5' } | { readonly state: 'S4'; readonly unpaid: number };

export interface HomeTilesInput {
  /** The prep as written, even when a sale has used it: `salePrep(events, null)`. */
  readonly prep: SalePrep | null;
  /** Fertilizings still to split (the prep's fourth row). */
  readonly unsplit: number;
  /** The farm's day now, YYYY-MM-DD (Bangkok): the tiles show this day only. */
  readonly today: string;
  readonly sales: readonly TileSale[];
}

export interface HomeTiles {
  readonly prep: PrepTile;
  readonly start: StartTile;
  /** The sale the start tile is about (today's newest), or null. */
  readonly startSaleId: string | null;
  /** Sales from an earlier day not finished (not closed, or closed with money still to pay): rows to deal with. */
  readonly carried: readonly TileSale[];
}

export function homeTiles({ prep, unsplit, today, sales }: HomeTilesInput): HomeTiles {
  const todays = sales.filter((s) => s.day >= today).sort((a, b) => b.ts - a.ts);
  const newest = todays[0] ?? null;
  const carried = sales.filter((s) => s.day < today && (s.phase !== 'closed' || s.unpaid > 0)).sort((a, b) => a.ts - b.ts);

  // A prep is live while nothing used it and its day has not passed; a sale today that started after it keeps it shown.
  const after = prep ? sales.filter((s) => s.ts > prep.updatedTs) : [];
  const usedToday = after.some((s) => s.day >= today);
  // An undated prep belongs to the Bangkok day it was last written (HT-5); a dated one to its sale day.
  const prepDay = prep ? (prep.date ?? farmToday(prep.updatedTs)) : null;
  const stale = prep !== null && !usedToday && (after.length > 0 || (prepDay !== null && prepDay < today));
  const live = prep !== null && !stale ? prep : null;
  const left = prepLeft(live, unsplit);
  const prepTile: PrepTile = !live ? { state: 'P0' } : left === 0 ? { state: 'P2' } : { state: 'P1', left };

  let start: StartTile;
  if (newest) {
    start =
      newest.phase === 'counting' ? { state: 'S2' } : newest.phase === 'clearing' ? { state: 'S3' } : newest.unpaid > 0 ? { state: 'S4', unpaid: newest.unpaid } : { state: 'S5' };
  } else {
    start = prepTile.state === 'P2' ? { state: 'S1' } : { state: 'S0' };
  }
  return { prep: prepTile, start, startSaleId: newest?.id ?? null, carried };
}
