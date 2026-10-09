/**
 * One money write at a time per form (review #3). A state flag alone cannot
 * stop two taps landing in the same tick — both handlers read the old
 * value — so the guard is a ref, mirrored into state for the disabled look.
 */

import { useCallback, useRef, useState } from 'react';

export function useInFlight(): { busy: boolean; run: (fn: () => Promise<void>) => Promise<void> } {
  const ref = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (ref.current) return;
    ref.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      ref.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}
