/**
 * Which baskets still count, and a basket's net (FR-6).
 *
 * Its own module so that the bridge-basket groups (`bridge.ts`) and the
 * rollups (`totals.ts`) can both build on it without importing each other.
 */

import type { BasketEvent, PileId, SaleEvent } from './types';
import { compareEvents } from './order';
import { deletedIds } from './soft-delete';

/**
 * The baskets that still count.
 *
 * A basket is live unless some `correction` event targets its id, or it (or
 * its pile, or its zone) is soft-deleted.
 * Corrections never mutate their target, so "was it voided?" is always a
 * question about the log, never about a flag someone remembered to set.
 */
export function liveBaskets(
  events: readonly SaleEvent[],
  pileId?: PileId,
): readonly BasketEvent[] {
  const voided = new Set<string>();
  const zoneOf = new Map<string, string>();
  for (const e of events) {
    if (e.kind === 'correction') voided.add(e.targetId);
    if (e.kind === 'sys' && e.payload.t === 'pile_added') zoneOf.set(e.payload.pileId, e.payload.zoneId);
  }
  // Soft Delete (E01-S04): a deleted basket, or one in a deleted pile or
  // zone, leaves the totals; restoring it puts it back exactly.
  const deleted = deletedIds(events);

  const out: BasketEvent[] = [];
  for (const e of events) {
    if (e.kind !== 'accept' && e.kind !== 'short') continue;
    if (voided.has(e.id)) continue;
    if (deleted.has(e.id) || deleted.has(e.pileId) || deleted.has(zoneOf.get(e.pileId) ?? '')) continue;
    if (pileId !== undefined && e.pileId !== pileId) continue;
    out.push(e);
  }
  return out.sort(compareEvents);
}

/** A short basket's net is derived, never stored: reading minus tare. */
export function basketNetG(b: BasketEvent): number {
  return b.kind === 'accept' ? b.netG : b.readingG - b.tareG - (b.skewG ?? 0);
}
