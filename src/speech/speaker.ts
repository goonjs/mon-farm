/**
 * The speech port.
 *
 * Two implementations sit behind it, and Metro picks by filename, exactly
 * like `src/store/store.ts`:
 *   speaker.native.ts — expo-speech
 *   speaker.web.ts    — the browser SpeechSynthesis API
 *
 * Both are on-device capability, never a network call (NFR-1, FR-11.7).
 */

export interface Speaker {
  /**
   * Speaks `text` in Thai. Resolves `true` if the platform reports the
   * utterance completed, `false` if it reports failure or no Thai voice is
   * available. MUST NOT reject — a speech failure is data (FR-11.10, logged
   * as `ok: false`), never an exception the caller has to guard against.
   */
  speak(text: string): Promise<boolean>;
}

/**
 * Ambient declaration only — see `store.ts`'s identical note. `tsc --noEmit`
 * needs something to resolve a bare `import { speaker } from './speaker'`
 * against; Metro's platform-extension resolution is what actually picks
 * `speaker.web.ts` or `speaker.native.ts` at bundle time.
 */
export declare const speaker: Speaker;
