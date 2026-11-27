/**
 * The finance scope and the app's minimum-version gate (E01-S28 round 1).
 *
 * Round 2 moves the finance log into the one `EventStore` under its own scope,
 * stored in place of a sale id the way `MASTER_SCOPE` is. A scope is not a
 * sale, so the sale lists and the home rows leave both out from round 1 on —
 * before any finance event is sent — so no build that hides them can see a
 * finance scope as an open sale (S28-AC12 ข).
 *
 * The group's minimum app release is an event in that scope, `kind: 'app_min'`
 * with `payload: { minApp }` (story schema section, Reviewer 20 N1): no new
 * envelope field, no new document, no rules change. The gate takes the
 * highest `minApp` in the store; with none there is no gate, so round 1 reads
 * nothing new and blocks nothing until round 2 writes the first one.
 */

import { MASTER_SCOPE } from './master';
import type { SaleEvent } from './types';

/** The scope finance events are stored under (round 2), like `MASTER_SCOPE`. Not a sale. */
export const FINANCE_SCOPE = 'farm-finance';

/**
 * This build's release number: a whole number raised by hand when a release
 * must keep older builds off the money screens. Round 1 was 1. Round 2 is 2
 * and writes the group minimum as 2 before the first finance event is sent:
 * a round-1 tab reads money from its old local log only, so it would show
 * totals without the synced money — it asks for an update instead.
 */
export const APP_RELEASE = 2;

/** The kind of the group-minimum event (`AppMinEvent` in `types.ts`). */
export const APP_MIN_KIND = 'app_min';

/** False for the reserved scopes stored in place of a sale id. */
export function isSaleScope(id: string): boolean {
  return id !== MASTER_SCOPE && id !== FINANCE_SCOPE;
}

/** The highest valid `minApp` among `app_min` events; null when there is none. */
export function minAppOf(events: readonly SaleEvent[]): number | null {
  let min: number | null = null;
  for (const e of events) {
    const loose = e as unknown as { kind: string; payload?: unknown };
    if (loose.kind !== APP_MIN_KIND || typeof loose.payload !== 'object' || loose.payload === null) continue;
    const v = (loose.payload as { minApp?: unknown }).minApp;
    if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && (min === null || v > min)) min = v;
  }
  return min;
}

/** True when the group's minimum is above this build: the money screens ask for an update. */
export function appBelowMin(events: readonly SaleEvent[], release: number = APP_RELEASE): boolean {
  const min = minAppOf(events);
  return min !== null && release < min;
}
