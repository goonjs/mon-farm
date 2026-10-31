/**
 * Where this device's text size is remembered (E03-S08). A device
 * preference like theme and language — not in the event log, never synced.
 * Kept through `device-settings` so it survives a restart on Android (E01-S19).
 */

import type { TextSize } from '../core/text-scale';
import { deviceSettings } from '../store/device-settings';

const KEY = 'mon-farm:text-size';

export function readTextSize(): TextSize | null {
  const raw = deviceSettings.get(KEY);
  return raw === 's' || raw === 'm' || raw === 'l' ? raw : null;
}

export function writeTextSize(size: TextSize): void {
  deviceSettings.set(KEY, size);
}
