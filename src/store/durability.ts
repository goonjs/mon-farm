/**
 * "Is what we record actually being kept?" — as a live signal, not a one-off
 * answer (E01-S03). Storage can fail after it opened fine: quota, a lost
 * IndexedDB connection on a backgrounded Safari tab, site data cleared. Once
 * that happens the app keeps counting, so the warning has to appear then,
 * not only at launch.
 *
 * Unsuffixed, like ./errors, so store.web.ts can import it safely.
 */

type Listener = () => void;

let lost = false;
const listeners = new Set<Listener>();

/** Records that storage stopped keeping events. Sticky until reload. */
export function markNotDurable(reason: unknown): void {
  console.warn('Storage is no longer keeping events.', reason);
  if (lost) return;
  lost = true;
  for (const l of listeners) l();
}

export function durabilityLost(): boolean {
  return lost;
}

export function onDurabilityLost(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
