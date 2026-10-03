/**
 * What may not be soft-deleted — or restored — yet (E01-S16, D-44).
 *
 * Owner 2026-10-03: a zone whose worker still has live deductions in the sale
 * cannot be deleted until those deductions are voided (or deleted) first —
 * otherwise the worker's share leaves the money while the deductions stay,
 * and the payout goes negative. This applies even when the worker has other
 * zones (the literal rule, and the safe one until D-18's "never more than the
 * share" exists in E06). The mirror image is blocked too: restoring a deleted
 * deduction against the worker of a deleted zone. "สวน" (properties) get the
 * same rule when they exist (E03-S02).
 *
 * Every write path checks here (`setDeleted`, `SaleProvider.append`); the
 * projection still folds a delete that arrived anyway (an older device), and
 * two devices racing here is a Conflict for E01-S11.
 */

import { compareEvents } from './order';
import { projectSale } from './project';
import { deletedIds } from './soft-delete';
import type { RecordId, SaleEvent } from './types';

/** A delete or restore the owner's rules do not allow yet; `blockers` says what to deal with first. */
export class DeleteBlockedError extends Error {
  constructor(
    readonly targetId: RecordId,
    readonly reason: 'live-deductions' | 'zone-deleted',
    readonly blockers: readonly RecordId[],
  ) {
    // Not for display: a screen builds its Thai message from `reason` and `blockers`.
    super(`${targetId}: ${reason} (${blockers.join(', ')})`);
    this.name = 'DeleteBlockedError';
  }
}

/** Deduction ids that stand in the way of deleting `id`; empty when nothing does. */
export function deleteBlockers(events: readonly SaleEvent[], id: RecordId): readonly RecordId[] {
  const state = projectSale(events);
  const worker = state.zones.find((z) => z.id === id)?.contract?.personId;
  if (!worker) return [];
  // `state.deductions` already leaves out deleted ones; voided ones no longer count.
  return state.deductions.filter((d) => d.personId === worker && !d.voided).map((d) => d.id);
}

/** Deleted zone ids whose worker a deleted deduction `id` is against — restoring it would bring the deduction back without the share. */
export function restoreBlockers(events: readonly SaleEvent[], id: RecordId): readonly RecordId[] {
  let person: string | undefined;
  const workerOf = new Map<string, string | null>();
  for (const e of [...events].sort(compareEvents)) {
    if (e.kind !== 'sys') continue;
    const p = e.payload;
    if (p.t === 'deduction_added' && p.deductionId === id) person = p.personId;
    if (p.t === 'zone_contract_set') workerOf.set(p.zoneId, p.personId);
    if (p.t === 'zone_contract_cleared') workerOf.set(p.zoneId, null);
  }
  if (!person) return [];
  const deleted = deletedIds(events);
  if (!deleted.has(id)) return [];
  return [...workerOf].filter(([zoneId, w]) => w === person && deleted.has(zoneId)).map(([zoneId]) => zoneId);
}

/** Throws `DeleteBlockedError` if deleting (or restoring) `id` would break D-44. */
export function assertAllowed(events: readonly SaleEvent[], id: RecordId, deleting: boolean): void {
  const blockers = deleting ? deleteBlockers(events, id) : restoreBlockers(events, id);
  if (blockers.length) {
    throw new DeleteBlockedError(id, deleting ? 'live-deductions' : 'zone-deleted', blockers);
  }
}
