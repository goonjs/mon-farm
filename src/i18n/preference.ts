/**
 * Where the language choice is remembered.
 *
 * A device preference, not sale data: it never enters the event log and never
 * syncs. Kept through `device-settings` (E01-S19) — localStorage on web under
 * the same key as before, expo-sqlite's kv-store on native — so the choice
 * survives a restart on Android too. Synchronous, so native can read it in the
 * first render and never flash Thai at an English user (DS-4).
 */

import type { Era } from '../core/thai-date';
import { deviceSettings } from '../store/device-settings';
import type { Locale } from './messages';

const KEY = 'mon-farm:locale';

function isLocale(v: unknown): v is Locale {
  return v === 'th' || v === 'en';
}

export function readLocale(): Locale | null {
  const raw = deviceSettings.get(KEY);
  return isLocale(raw) ? raw : null;
}

export function writeLocale(locale: Locale): void {
  deviceSettings.set(KEY, locale);
}

/** Buddhist or Common Era for every date in the app (D-74 F14). Same terms as the language. */
const ERA_KEY = 'mon-farm:era';

export function readEra(): Era | null {
  const raw = deviceSettings.get(ERA_KEY);
  return raw === 'be' || raw === 'ce' ? raw : null;
}

export function writeEra(era: Era): void {
  deviceSettings.set(ERA_KEY, era);
}
