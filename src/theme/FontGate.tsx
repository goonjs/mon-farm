import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';

import { fontAssets } from './fonts';

/**
 * How long first paint waits for the embedded font before giving up. Loading
 * from the app bundle takes well under a second; this only matters if a load
 * never settles, which on native has no timeout of its own.
 */
export const FONT_LOAD_TIMEOUT_MS = 3000;

// Keep the native splash up until the font is ready, rather than letting it
// auto-hide onto a blank frame. A no-op on web.
void SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Holds the first paint until the embedded Thai font is ready, so no screen
 * flashes in a fallback face first (E01-S13). A failed or stalled load
 * renders anyway, with the platform's default face (weights collapse to
 * regular): a worse look, not a reason to stop someone counting.
 */
export function FontGate({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts(fontAssets);
  const [timedOut, setTimedOut] = useState(false);
  const ready = loaded || !!error || timedOut;

  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => setTimedOut(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [ready]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return <>{children}</>;
}
