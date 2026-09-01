/**
 * Native speech, via `expo-speech`. Metro resolves this file on iOS/Android;
 * `speaker.web.ts` is used on web. See `speaker.ts` for the port this
 * implements.
 *
 * `Speech.speak()` is fire-and-forget with callbacks, not a Promise, so this
 * wraps it in one. On-device TTS only — no network call (NFR-1, FR-11.7).
 */

import * as Speech from 'expo-speech';

import type { Speaker } from './speaker';

export const speaker: Speaker = {
  speak(text: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        Speech.speak(text, {
          language: 'th-TH',
          onDone: () => resolve(true),
          onError: () => resolve(false),
          // A stop mid-utterance means it was not heard to completion — the
          // conservative answer, per FR-11.10, when the outcome is uncertain.
          // Nothing in this story calls Speech.stop(), so this is defensive
          // rather than reachable today.
          onStopped: () => resolve(false),
        });
      } catch {
        resolve(false);
      }
    });
  },
};
