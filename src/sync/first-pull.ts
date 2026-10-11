/**
 * The points wizard waits for the first pull (E01-S09, decision 2026-10-10):
 * two phones that are offline and empty would otherwise each create "จุด 1",
 * and the log would hold both. Once this device has pulled the group's events
 * it can see the other phone's points and the wizard refuses the duplicate name.
 *
 * A build or session that does not sync has nothing to wait for and is never
 * held up: the wizard works as it always did.
 */

import type { SyncMode } from './changed';

/** `cursor` is the store's pull cursor: 0 = this device has never completed a pull. */
export function firstPullDone(mode: SyncMode, cursor: number): boolean {
  if (mode === 'off') return true;
  if (mode === 'connecting') return false;
  return cursor > 0;
}
