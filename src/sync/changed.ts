/**
 * "The sync state changed" (E01-S09): the running engine tells the badge and
 * the points wizard to re-read, without them knowing whether an engine exists
 * on this build.
 *
 * `syncMode` says whether one does: `off` = this build/session does not sync
 * (nothing to wait for), `connecting` = about to, `on` = running.
 * `engineStatus` is the running engine's latest status (null when none), which
 * is how an error (denied, database missing, a refused event) becomes visible
 * outside the engine.
 */

import type { SyncStatus } from './engine';

export type SyncMode = 'off' | 'connecting' | 'on';

const listeners = new Set<() => void>();
let mode: SyncMode = 'off';
let since = Date.now();
let status: SyncStatus | null = null;

export function onSyncChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A listener's failure must not stop the others or reach the engine. */
export function emitSyncChanged(): void {
  for (const l of [...listeners]) {
    try {
      l();
    } catch (err) {
      console.warn('A sync listener failed.', err);
    }
  }
}

export const syncMode = (): SyncMode => mode;
/** When the current mode began (ms since the epoch): how long sync has been trying. */
export const syncModeSince = (): number => since;

export function setSyncMode(next: SyncMode): void {
  if (next === mode) return;
  mode = next;
  since = Date.now();
  if (next === 'off') status = null;
  emitSyncChanged();
}

export const engineStatus = (): SyncStatus | null => status;

export function setEngineStatus(next: SyncStatus | null): void {
  status = next;
  emitSyncChanged();
}
