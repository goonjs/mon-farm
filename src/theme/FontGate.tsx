import { useFonts } from 'expo-font';
import type { ReactNode } from 'react';

import { fontAssets } from './fonts';

/**
 * Holds the first paint until the embedded Thai font is ready, so no screen
 * flashes in a fallback face first (E01-S13). A load failure renders anyway:
 * the system font is a worse look, not a reason to stop someone counting.
 */
export function FontGate({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts(fontAssets);
  if (!loaded && !error) return null;
  return <>{children}</>;
}
