/**
 * Where this device's tab icon is remembered (E03-S10). A device preference
 * like theme and text size — not in the event log, never synced. Kept through
 * `device-settings`, never localStorage directly (guard test). An id that is
 * not a current choice (an icon later removed, or the old "default" = เดิม)
 * reads as the default, กรีดยาง.
 */

import { deviceSettings } from '../../store/device-settings';
import { FAVICON_CHOICES, FAVICON_DEFAULT } from './choices';

const KEY = 'mon-farm:favicon';

export function readFavicon(): string {
  const raw = deviceSettings.get(KEY);
  return raw !== null && FAVICON_CHOICES.includes(raw) ? raw : FAVICON_DEFAULT;
}

export function writeFavicon(id: string): void {
  deviceSettings.set(KEY, id);
}
