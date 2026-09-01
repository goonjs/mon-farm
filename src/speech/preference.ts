/**
 * Where the speech on/off choice is remembered.
 *
 * Mirrors `src/i18n/preference.ts` exactly, including the reasoning: whether
 * speech is on is a preference of the DEVICE, not a fact about a sale, so it
 * lives beside the language and theme choices rather than in the append-only
 * log. A sale's own log gets a `speech_set` event only when the toggle is
 * flipped from inside that sale (see `counter.tsx`) — this file has nothing
 * to do with that; it only remembers the setting between launches.
 */

const KEY = 'mon-farm:speech-on';

export async function readSpeechOn(): Promise<boolean | null> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

export async function writeSpeechOn(on: boolean): Promise<void> {
  try {
    globalThis.localStorage?.setItem(KEY, on ? 'true' : 'false');
  } catch {
    /* a quota or privacy-mode error must not take the app down */
  }
}
