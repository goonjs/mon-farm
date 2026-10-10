/**
 * Where this device's text size is remembered (E03-S08). A device
 * preference like theme and language — not in the event log, never synced.
 */

import type { TextSize } from '../core/text-scale';

const KEY = 'mon-farm:text-size';

export function readTextSize(): TextSize | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw === 's' || raw === 'm' || raw === 'l' ? raw : null;
  } catch {
    return null;
  }
}

export function writeTextSize(size: TextSize): void {
  try {
    globalThis.localStorage?.setItem(KEY, size);
  } catch {
    /* a quota or privacy-mode error must not take the app down */
  }
}
