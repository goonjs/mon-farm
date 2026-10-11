/**
 * "The sync state changed" (E01-S09): the running engine tells the badge to
 * re-read, without the badge knowing whether an engine exists on this build.
 */

const listeners = new Set<() => void>();

export function onSyncChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSyncChanged(): void {
  for (const l of [...listeners]) l();
}
