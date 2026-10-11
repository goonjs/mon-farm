/**
 * "Something was just recorded" (E01-S09): lets the sync engine send soon after
 * a local write without the store knowing the engine exists, and lets the sync
 * badge refresh at once. Fire-and-forget; a listener's failure never reaches
 * the write that triggered it.
 */

const listeners = new Set<() => void>();

export function onAppended(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitAppended(): void {
  for (const l of [...listeners]) {
    try {
      l();
    } catch (err) {
      console.warn('An append listener failed.', err);
    }
  }
}
