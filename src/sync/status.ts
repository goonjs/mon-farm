/**
 * The overall sync state shown in every screen header (SYNC-3, D-28).
 *
 * Pure, so the rule is testable without a store or React: nothing pending is
 * "synced"; anything pending says how many; a conflict outranks both because
 * it is the one state that needs the user (D-3). There is no backend yet, so
 * conflicts are always 0 today and recorded events stay pending — the pill
 * reports exactly what the local store holds, nothing invented.
 */

import type { MessageId } from '../i18n/messages';

export type SyncState = 'synced' | 'pending' | 'conflict';

export interface SyncStatus {
  readonly state: SyncState;
  /** Events pending, or conflicts when `state` is 'conflict'; 0 when synced. */
  readonly count: number;
}

export function syncStatusFrom({ pending, conflicts = 0 }: { pending: number; conflicts?: number }): SyncStatus {
  if (conflicts > 0) return { state: 'conflict', count: conflicts };
  if (pending > 0) return { state: 'pending', count: pending };
  return { state: 'synced', count: 0 };
}

/** The catalogue entry carrying each state's word (with `{n}` where counted). */
export function syncWordId(state: SyncState): MessageId {
  return ({ synced: 'sync.synced', pending: 'sync.pending', conflict: 'sync.conflict' } as const)[state];
}
