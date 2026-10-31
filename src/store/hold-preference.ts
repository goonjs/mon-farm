/**
 * Where this device's hold time is remembered (E03-S07, D-7, D-79).
 *
 * Like speech on/off (`src/speech/preference.ts`), the hold time belongs to
 * the DEVICE — owner 2026-10-03: a phone held in a glove and a tablet on a
 * bench want different times — so it is not a group setting and never syncs.
 * Default 0.7 s; anything stored outside 0.5–1 s is ignored. Kept through
 * `device-settings` so it survives a restart on Android (E01-S19).
 */

import { validHoldMs } from '../core/master';
import { deviceSettings } from './device-settings';

const KEY = 'mon-farm:hold-ms';
export const DEFAULT_HOLD_MS = 700;

export function readHoldMs(): number {
  const n = Number(deviceSettings.get(KEY));
  return validHoldMs(n) ? n : DEFAULT_HOLD_MS;
}

export function writeHoldMs(ms: number): void {
  if (!validHoldMs(ms)) return;
  deviceSettings.set(KEY, String(ms));
}

/** Whether a basket is counted by pressing and holding, or by one tap (E04-S17). Also this device's own. */
export type CountMode = 'hold' | 'tap';
const MODE_KEY = 'mon-farm:count-mode';

export function readCountMode(): CountMode {
  return deviceSettings.get(MODE_KEY) === 'tap' ? 'tap' : 'hold';
}

export function writeCountMode(mode: CountMode): void {
  deviceSettings.set(MODE_KEY, mode);
}
