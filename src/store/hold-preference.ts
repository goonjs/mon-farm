/**
 * Where this device's hold time is remembered (E03-S07, D-7, D-79).
 *
 * Like speech on/off (`src/speech/preference.ts`), the hold time belongs to
 * the DEVICE — owner 2026-10-03: a phone held in a glove and a tablet on a
 * bench want different times — so it is not a group setting and never syncs.
 * Default 0.7 s; anything stored outside 0.5–1 s is ignored.
 */

import { validHoldMs } from '../core/master';

const KEY = 'mon-farm:hold-ms';
export const DEFAULT_HOLD_MS = 700;

export function readHoldMs(): number {
  try {
    const n = Number(globalThis.localStorage?.getItem(KEY));
    return validHoldMs(n) ? n : DEFAULT_HOLD_MS;
  } catch {
    return DEFAULT_HOLD_MS;
  }
}

export function writeHoldMs(ms: number): void {
  if (!validHoldMs(ms)) return;
  try {
    globalThis.localStorage?.setItem(KEY, String(ms));
  } catch {
    /* a quota or privacy-mode error must not take the app down */
  }
}
