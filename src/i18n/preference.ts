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
