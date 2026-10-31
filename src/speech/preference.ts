/**
 * Where the speech on/off choice is remembered.
 *
 * Mirrors `src/i18n/preference.ts` exactly, including the reasoning: whether
 * speech is on is a preference of the DEVICE, not a fact about a sale, so it
 * lives beside the language and theme choices rather than in the append-only
 * log. A sale's own log gets a `speech_set` event only when the toggle is
 * flipped from inside that sale (see `counter.tsx`) — this file has nothing
 * to do with that; it only remembers the setting between launches, through
 * `device-settings` (E01-S19), so it survives a restart on Android too.
 */

import { deviceSettings } from '../store/device-settings';

const KEY = 'mon-farm:speech-on';

export function readSpeechOn(): boolean | null {
  const raw = deviceSettings.get(KEY);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

export function writeSpeechOn(on: boolean): void {
  deviceSettings.set(KEY, on ? 'true' : 'false');
}
