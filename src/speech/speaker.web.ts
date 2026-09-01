/**
 * Web speech. Metro resolves this file on web; `speaker.native.ts` is used on
 * device. See `speaker.ts` for the port this implements.
 *
 * The browser SpeechSynthesis API, deliberately — no network call, so this
 * satisfies NFR-1 / FR-11.7 the same way the native adapter does. Availability
 * varies by browser and by whether a Thai voice is installed; `speak()`
 * resolves `false` rather than throwing when it is not, which is what feeds
 * the degraded-state pill (S10, FR-11.10).
 */

import type { Speaker } from './speaker';

function unavailable(): Speaker {
  return { speak: async () => false };
}

function realSpeaker(): Speaker {
  return {
    speak(text: string): Promise<boolean> {
      return new Promise((resolve) => {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'th-TH';
          utterance.onend = () => resolve(true);
          // Interrupted (e.g. a page navigation) counts as not heard —
          // FR-11.10 wants the conservative answer when the outcome is
          // uncertain, not an optimistic guess.
          utterance.onerror = () => resolve(false);
          window.speechSynthesis.speak(utterance);
        } catch {
          resolve(false);
        }
      });
    },
  };
}

const hasSpeechSynthesis =
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  typeof SpeechSynthesisUtterance !== 'undefined';

export const speaker: Speaker = hasSpeechSynthesis ? realSpeaker() : unavailable();
