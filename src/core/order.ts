import type { SaleEvent } from './types';

/**
 * The one fold order: `(seq, deviceId, deviceSeq, id)`. Total and independent
 * of any clock (NFR-3) and of the order rows arrived in. For a single device
 * it is exactly the order things were recorded in; `id` only breaks the tie
 * left by two installs sharing a cloned device id.
 */
export function compareEvents(a: SaleEvent, b: SaleEvent): number {
  if (a.seq !== b.seq) return a.seq - b.seq;
  if (a.actor.deviceId !== b.actor.deviceId) return a.actor.deviceId < b.actor.deviceId ? -1 : 1;
  if (a.deviceSeq !== b.deviceSeq) return a.deviceSeq - b.deviceSeq;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
