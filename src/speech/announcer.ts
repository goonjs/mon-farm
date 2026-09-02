/**
 * Speaks a basket count and logs the attempt.
 *
 * Fire-and-forget, on purpose — the same discipline `SaleProvider.append()`
 * uses for persistence ("Fire-and-forget: a storage failure must never block
 * counting"). FR-11.4 requires the counter to be immediately ready for the
 * next basket; FR-11.10 requires that a speech failure never blocks or
 * corrupts the count. Both rule out awaiting the speaker here.
 */

import { thaiNumber } from '../core/thai-number';
import type { Speaker } from './speaker';

export type AnnounceAppend = (event: {
  kind: 'sys';
  payload: { t: 'announced'; thai: string; ok: boolean };
}) => void;

export function announceCount(n: number, speaker: Speaker, append: AnnounceAppend): void {
  const thai = thaiNumber(n);
  speaker
    .speak(thai)
    .then((ok) => append({ kind: 'sys', payload: { t: 'announced', thai, ok } }))
    // Speaker.speak() is documented not to reject, but a third-party platform
    // API is not code this repo controls — treat a rejection the same as a
    // reported failure rather than letting it become an unhandled rejection.
    .catch(() => append({ kind: 'sys', payload: { t: 'announced', thai, ok: false } }));
}
