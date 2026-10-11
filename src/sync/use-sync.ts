/**
 * Runs the sync engine while someone is signed in to a group (E01-S09).
 *
 * Mounted by the account gate only once a user and a group are open, so it
 * starts on app open and stops when the session goes. Starting is a background
 * promise: the screens render and work at once, with or without a network, a
 * Firebase config or an adapter for this platform.
 */

import { useEffect } from 'react';

import type { GroupId, UserId } from '../core/types';
import type { AccountStore } from '../store/account';
import { accountStore } from '../store/account';
import { onAppended } from '../store/append-signal';
import { store } from '../store/store';
import { connectRemote, type SyncRemote } from './client';
import { startSync, type SyncHandle } from './runtime';
import { emitSyncChanged, setSyncMode } from './changed';

/** The browser's `online` event; native has no such global, and there the client is not built anyway. */
const onOnline = (listener: () => void) => {
  const target = globalThis as { addEventListener?: (t: string, l: () => void) => void; removeEventListener?: (t: string, l: () => void) => void };
  target.addEventListener?.('online', listener);
  return () => target.removeEventListener?.('online', listener);
};

const isOnline = () => globalThis.navigator?.onLine !== false;

export function useSync(
  userId: UserId,
  groupId: GroupId,
  accounts: AccountStore = accountStore,
  connect: (userId: UserId, groupId: GroupId) => Promise<SyncRemote | null> = connectRemote,
): void {
  useEffect(() => {
    let live = true;
    let handle: SyncHandle | null = null;
    // Until we know, the points wizard waits (a first pull may be coming).
    setSyncMode('connecting');
    connect(userId, groupId)
      .then((remote) => {
        if (!live) return;
        if (!remote) return setSyncMode('off');
        handle = startSync({
          scope: { userId, groupId },
          store,
          accounts,
          remote,
          onAppended,
          onOnline,
          onPulled: emitSyncChanged,
          isOnline,
        });
        handle.engine.subscribe(emitSyncChanged);
        setSyncMode('on');
      })
      .catch((err) => {
        console.warn('Sync could not start; the app stays local.', err);
        if (live) setSyncMode('off');
      });
    return () => {
      live = false;
      handle?.stop();
      setSyncMode('off');
    };
  }, [userId, groupId, accounts, connect]);
}
