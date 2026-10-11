/**
 * Reads the overall sync state from the local store for the header pill.
 * Refreshes whenever the screen regains focus, after every local write, and
 * whenever the sync engine reports a change, so a basket counted on the counter
 * shows up as pending at once and goes away when it has been sent.
 *
 * Counts only what this signed-in user still has to send for the open group
 * (E01-S09): other accounts' events, other groups' and events from before
 * groups existed are never sent, so they are not "pending". A group created
 * offline and not yet on the server counts as one.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

// Bare specifier — see the note in SaleProvider.tsx for why this matters.
import { waitingCount } from '../core/scope';
import { accountStore } from '../store/account';
import { onAppended } from '../store/append-signal';
import { sessionGroupId, sessionUserId } from '../store/session';
import { store } from '../store/store';
import { onSyncChanged } from './changed';
import { syncStatusFrom, type SyncStatus } from './status';

async function readStatus(): Promise<SyncStatus> {
  const scope = { userId: sessionUserId(), groupId: sessionGroupId() };
  // A group list that cannot be read must not hide the events that can be.
  const [events, ops] = await Promise.all([store.pending(), accountStore.pendingOps().catch(() => [])]);
  return syncStatusFrom({ pending: waitingCount(scope, events, ops) });
}

export function useSyncStatus(): SyncStatus | null {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      const refresh = () => {
        readStatus()
          .then((next) => live && setStatus(next))
          .catch(() => live && setStatus(null));
      };
      refresh();
      const stop = [onAppended(refresh), onSyncChanged(refresh)];
      return () => {
        live = false;
        for (const off of stop) off();
      };
    }, []),
  );
  return status;
}
