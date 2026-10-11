/**
 * "The sync state changed" (E01-S09): the running engine tells the badge and
 * the points wizard to re-read, without them knowing whether an engine exists
 * on this build.
 *
 * `syncMode` says whether one does: `off` = this build/session does not sync
 * (nothing to wait for), `connecting` = about to, `on` = running.
 */

export type SyncMode = 'off' | 'connecting' | 'on';

const listeners = new Set<() => void>();
let mode: SyncMode = 'off';

export function onSyncChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSyncChanged(): void {
  for (const l of [...listeners]) l();
}

export const syncMode = (): SyncMode => mode;

export function setSyncMode(next: SyncMode): void {
  if (next === mode) return;
  mode = next;
  emitSyncChanged();
}
