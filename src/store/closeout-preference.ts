/**
 * The last choices on the close-out cash step (E05-S11 CO-23, D-67, D-71):
 * how each tapper's debt repayment was taken, and the group's rounding.
 *
 * A DEVICE setting (owner 2026-10-31, Q10/Q12): kept on this phone only,
 * never an event, never synced. The money itself is always recorded with the
 * existing events at "ยืนยันยอด"; this only preselects next time, and is
 * written only after that confirm. Unknown or unreadable values fall back to
 * the first item of the menu.
 *
 * Storage is injected (a sync get/set, the E01-S19 device-settings contract)
 * so this works and is tested before that module lands.
 */

import { REPAY_ROUTES, ROUNDING_MENU, type RepayRoute } from '../core/finance/closeout';
import type { RoundingMode } from '../core/finance/deduct';
import { deviceSettings } from './device-settings';

export interface PreferenceStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const repayKey = (groupId: string, workerId: string) => `mon-farm:last-repay:${groupId}:${workerId}`;
export const roundingKey = (groupId: string) => `mon-farm:last-rounding:${groupId}`;

function read<T extends string>(store: PreferenceStore, key: string, menu: readonly T[]): T {
  try {
    const v = store.get(key);
    return (menu as readonly string[]).includes(v ?? '') ? (v as T) : menu[0];
  } catch {
    return menu[0];
  }
}

function write(store: PreferenceStore, key: string, value: string): void {
  try {
    store.set(key, value);
  } catch {
    /* a storage error must not take the confirm down: next time starts from the menu's first item */
  }
}

export const lastRepay = (store: PreferenceStore, groupId: string, workerId: string): RepayRoute => read(store, repayKey(groupId, workerId), REPAY_ROUTES);
export const lastRounding = (store: PreferenceStore, groupId: string): RoundingMode => read(store, roundingKey(groupId), ROUNDING_MENU);

/** After "ยืนยันยอด" only: remember what was used. */
export function rememberCloseout(store: PreferenceStore, groupId: string, routes: readonly { workerId: string; route: RepayRoute }[], rounding: RoundingMode | null): void {
  for (const r of routes) write(store, repayKey(groupId, r.workerId), r.route);
  if (rounding) write(store, roundingKey(groupId), rounding);
}

/**
 * This device's settings store (E01-S19): localStorage on web, the SQLite
 * kv-store on Android — so the last choice is remembered on both. Read only
 * after the sale and finance logs load (never in the first render).
 */
export const localPreferenceStore: PreferenceStore = deviceSettings;
