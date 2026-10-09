/**
 * Where the language choice is remembered.
 *
 * One file, no platform split, unlike `store.ts` / `people.ts`. Those two
 * carry the sale — losing an event loses money someone is owed, which is what
 * justifies expo-sqlite and its own adapter per platform. Losing a language
 * preference costs one tap. `localStorage` is present on web and React Native
 * has no equivalent global, so the read simply finds nothing on native and the
 * app opens in Thai — which is the correct default there anyway.
 *
 * Async on purpose: it makes swapping in a real native store later (AsyncStorage,
 * expo-sqlite, whatever S27's farm profile ends up using) a change behind this
 * function rather than a change to every caller.
 */

import type { Era } from '../core/thai-date';
import type { Locale } from './messages';

const KEY = 'mon-farm:locale';

function isLocale(v: unknown): v is Locale {
  return v === 'th' || v === 'en';
}

export async function readLocale(): Promise<Locale | null> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function writeLocale(locale: Locale): Promise<void> {
  try {
    globalThis.localStorage?.setItem(KEY, locale);
  } catch {
    /* a quota or privacy-mode error must not take the app down */
  }
}

/** Buddhist or Common Era for every date in the app (D-74 F14). Same terms as the language. */
const ERA_KEY = 'mon-farm:era';

export async function readEra(): Promise<Era | null> {
  try {
    const raw = globalThis.localStorage?.getItem(ERA_KEY);
    return raw === 'be' || raw === 'ce' ? raw : null;
  } catch {
    return null;
  }
}

export async function writeEra(era: Era): Promise<void> {
  try {
    globalThis.localStorage?.setItem(ERA_KEY, era);
  } catch {
    /* the choice just does not survive a restart */
  }
}
