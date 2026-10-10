/**
 * What the sync status shows (E01-S10): one badge for the app header and one
 * state per sale. Pure — the engine's `SyncStatus` and the store's outbox go
 * in, message ids come out, so every state is testable without a screen.
 *
 * Status is per sale, never per basket (D-28); a basket in conflict carries
 * its own flag on top. Priority: conflict → error → pending → synced
 * (architecture §สถานะ sync). Being offline is pending, never an error, and
 * the retry action appears only for an error or a conflict (D-3).
 */

import type { EventId, SaleEvent } from '../core/types';
import type { MessageId } from '../i18n/messages';
import type { SyncStatus } from './engine';

export type SaleSyncState = 'conflict' | 'error' | 'pending' | 'synced';

export function saleSyncState(
  events: readonly SaleEvent[],
  pendingIds: ReadonlySet<EventId>,
  flags: { conflictIds?: ReadonlySet<EventId>; errorIds?: ReadonlySet<EventId> } = {},
): SaleSyncState {
  const any = (set?: ReadonlySet<EventId>) => !!set && events.some((e) => set.has(e.id));
  if (any(flags.conflictIds)) return 'conflict';
  if (any(flags.errorIds)) return 'error';
  if (any(pendingIds)) return 'pending';
  return 'synced';
}

export interface Badge {
  readonly kind: SaleSyncState;
  readonly count?: number;
  readonly showRetry: boolean;
}

export function overallBadge(status: SyncStatus, conflicts: number): Badge {
  if (conflicts > 0) return { kind: 'conflict', count: conflicts, showRetry: true };
  if (status.state === 'error') return { kind: 'error', showRetry: true };
  // Offline with an empty outbox has nothing to send: "รอส่ง 0" would only alarm.
  if (status.pending > 0) {
    return { kind: 'pending', count: status.pending, showRetry: false };
  }
  return { kind: 'synced', showRetry: false };
}

/** The header label as `resolve` arguments. */
export function overallLabel(b: Badge): [MessageId, Record<string, number>?] {
  switch (b.kind) {
    case 'conflict':
      return ['sync.conflictN', { n: b.count ?? 0 }];
    case 'error':
      return ['sync.errorRetry'];
    case 'pending':
      return ['sync.pendingN', { n: b.count ?? 0 }];
    case 'synced':
      return ['sync.synced'];
  }
}

const SALE_LABEL: Record<SaleSyncState, MessageId> = {
  synced: 'sync.synced',
  pending: 'sync.salePending',
  conflict: 'sync.saleConflict',
  error: 'sync.saleError',
};

export const saleLabel = (s: SaleSyncState): MessageId => SALE_LABEL[s];
