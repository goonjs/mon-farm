/**
 * The React binding over the speech on/off preference. Mirrors
 * `src/i18n/index.tsx` deliberately — same shape, same reasoning: the rules
 * that matter live in the pure tier (`announcer.ts`, the `Speaker` port), and
 * this only adds "is it on" plus remembering the choice between launches.
 *
 * Does NOT carry the `speaker` singleton itself — that is a stable platform
 * object, imported directly wherever it is used (`counter.tsx`), the same way
 * `SaleProvider` imports `store` directly rather than through context.
 *
 * Does NOT log anything. A `speech_set` event belongs to a specific sale's
 * log, and this provider sits above the `/sale/[id]` segment with no sale in
 * scope — see `counter.tsx`'s own toggle for the sale-log side of FR-11.11.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { deviceSettings } from '../store/device-settings';
import { readSpeechOn, writeSpeechOn } from './preference';

interface SpeechContextValue {
  speechOn: boolean;
  setSpeechOn: (on: boolean) => void;
}

const SpeechContext = createContext<SpeechContextValue | null>(null);

export function SpeechProvider({ children, initial = true }: { children: ReactNode; initial?: boolean }) {
  // Native reads the stored choice in the first render (E01-S19 DS-4).
  const [speechOn, setSpeechOnState] = useState<boolean>(() =>
    deviceSettings.readDuringRender ? (readSpeechOn() ?? initial) : initial,
  );

  // On web, read after mount, not during render — see src/i18n/index.tsx's
  // identical note: this app static-renders on web, and a value read from
  // device storage during render would differ between the server-rendered
  // HTML and the first client render.
  useEffect(() => {
    if (deviceSettings.readDuringRender) return;
    // A microtask, as when this read was async: same web timing as before.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const stored = readSpeechOn();
      if (stored !== null) setSpeechOnState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setSpeechOn = useCallback((on: boolean) => {
    setSpeechOnState(on);
    // Fire and forget: a storage failure must not stop someone toggling
    // speech, it just means the choice does not survive a restart.
    writeSpeechOn(on);
  }, []);

  const value = useMemo<SpeechContextValue>(() => ({ speechOn, setSpeechOn }), [speechOn, setSpeechOn]);

  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

export function useSpeech(): SpeechContextValue {
  const ctx = useContext(SpeechContext);
  if (!ctx) throw new Error('useSpeech must be used inside <SpeechProvider>');
  return ctx;
}
