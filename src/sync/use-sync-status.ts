/**
 * Reads the overall sync state from the local store for the header pill.
 * Refreshes whenever the screen regains focus, so a basket counted on the
 * counter shows up as pending when the user comes back.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

// Bare specifier — see the note in SaleProvider.tsx for why this matters.
import { store } from '../store/store';
import { syncStatusFrom, type SyncStatus } from './status';

export function useSyncStatus(): SyncStatus | null {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      store
        .pending()
        .then((events) => live && setStatus(syncStatusFrom({ pending: events.length })))
        .catch(() => live && setStatus(null));
      return () => {
        live = false;
      };
    }, []),
  );
  return status;
}
