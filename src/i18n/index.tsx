/**
 * The React binding over `resolve.ts`. Deliberately thin — the rules that
 * matter (fallback, interpolation, never rendering an id) are proven in the
 * Vitest tier against the pure function; all this adds is "which locale", and
 * remembering it between launches.
 *
 * ── Why the preference is stored, and why not in the event log ──────────────
 *
 * Which language somebody read a number in is not a fact about the sale. It
 * describes the reader, not the trade, so it lives in device preferences
 * beside the theme rather than in the append-only log that two parties settle
 * against. Nothing about it ever syncs.
 *
 * Thai is the default with no stored preference, and deliberately does NOT
 * consult the device locale. This is an app for a Thai farm; a phone set to
 * English by a shop, or a browser reporting en-US, is not evidence that the
 * person holding it wants English labels on a counting screen.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { type Locale, type MessageId } from './messages';
import { resolve } from './resolve';
import type { Era } from '../core/thai-date';
import { deviceSettings } from '../store/device-settings';
import { readEra, readLocale, writeEra, writeLocale } from './preference';

export type Translate = (id: MessageId, params?: Record<string, string | number>) => string;

interface I18nContextValue {
  locale: Locale;
  t: Translate;
  setLocale: (l: Locale) => void;
  toggle: () => void;
  /** Year system for every date shown (D-74 F14); Buddhist Era unless switched. */
  era: Era;
  toggleEra: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, initial = 'th' }: { children: ReactNode; initial?: Locale }) {
  // Native reads the stored choice in the first render, so an English user
  // never sees a Thai frame first (E01-S19 DS-4); the read is synchronous.
  const [locale, setLocaleState] = useState<Locale>(() =>
    deviceSettings.readDuringRender ? (readLocale() ?? initial) : initial,
  );
  const [era, setEra] = useState<Era>(() => (deviceSettings.readDuringRender ? (readEra() ?? 'be') : 'be'));

  /**
   * On web, read after mount rather than during render, for the same reason
   * `use-color-scheme.web.ts` defers: this app static-renders on web, and a
   * value read from device storage during render would differ between the
   * server-rendered HTML and the first client render. Thai is the default on
   * both sides, so the pre-hydration paint is already correct for almost
   * every launch.
   */
  useEffect(() => {
    if (deviceSettings.readDuringRender) return;
    // A microtask, as when this read was async: same web timing as before.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const storedLocale = readLocale();
      if (storedLocale) setLocaleState(storedLocale);
      const storedEra = readEra();
      if (storedEra) setEra(storedEra);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    // Fire and forget: a storage failure must not stop someone switching
    // language, it just means the choice does not survive a restart.
    writeLocale(l);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (id, params) => resolve(locale, id, params),
      setLocale,
      toggle: () => setLocale(locale === 'th' ? 'en' : 'th'),
      era,
      // From the latest state, not this render's: a fast double tap must
      // switch twice. Writing inside the updater is idempotent if re-run.
      toggleEra: () =>
        setEra((e) => {
          const next = e === 'be' ? 'ce' : 'be';
          writeEra(next);
          return next;
        }),
    }),
    [locale, setLocale, era],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The translate function. The common case, and the only thing most callers need. */
export function useT(): Translate {
  return useI18n().t;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT / useI18n must be used inside <I18nProvider>');
  return ctx;
}

export type { Locale, MessageId };
