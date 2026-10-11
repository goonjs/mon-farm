/**
 * Whether the points wizard may create points yet (E01-S09), and if not, why:
 * waiting for the first pull, or sync is not available (offline, error, taking
 * too long) and the person may go on. See `first-pull.ts` for the rule.
 *
 * Re-checks when sync reports a change (every completed pull included), when
 * the browser goes online or offline, and when the grace period runs out.
 */

import { useEffect, useState } from 'react';

import { accountStore } from '../store/account';
import { sessionGroupId, sessionUserId } from '../store/session';
import { store } from '../store/store';
import { engineStatus, onSyncChanged, syncMode, syncModeSince } from './changed';
import { firstPullGate, GRACE_MS, type FirstPullGate } from './first-pull';

const online = () => globalThis.navigator?.onLine !== false;

async function readGate(): Promise<FirstPullGate> {
  const mode = syncMode();
  if (mode === 'off') return { kind: 'ready' };
  let groupId = '';
  let userId = '';
  try {
    groupId = sessionGroupId();
    userId = sessionUserId();
  } catch {
    return { kind: 'ready' }; // no session: nothing is recorded, nothing to protect
  }
  const [cursor, ops] = await Promise.all([
    store.syncCursor(groupId).catch(() => 0),
    accountStore.pendingOps().catch(() => []),
  ]);
  return firstPullGate({
    mode,
    cursor,
    groupOnlyHere: ops.some((o) => o.groupId === groupId && o.createdBy === userId),
    online: online(),
    syncError: engineStatus()?.state === 'error',
    elapsedMs: Date.now() - syncModeSince(),
  });
}

const sameGate = (a: FirstPullGate, b: FirstPullGate) =>
  a.kind === b.kind && (a as { reason?: string }).reason === (b as { reason?: string }).reason;

export function useFirstPullGate(): FirstPullGate {
  // Optimistic only when there is no sync at all; otherwise wait to be told.
  const [gate, setGate] = useState<FirstPullGate>(() =>
    syncMode() === 'off' ? { kind: 'ready' } : { kind: 'waiting' },
  );
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      readGate()
        .then((next) => {
          if (!live) return;
          setGate((cur) => (sameGate(cur, next) ? cur : next));
          // Still waiting: look again when the grace period ends.
          clearTimeout(timer);
          if (next.kind === 'waiting') {
            timer = setTimeout(check, Math.max(0, GRACE_MS - (Date.now() - syncModeSince())) + 50);
          }
        })
        .catch(() => live && setGate({ kind: 'unavailable', reason: 'error' }));
    };
    check();
    const off = onSyncChanged(check);
    const target = globalThis as {
      addEventListener?: (t: string, l: () => void) => void;
      removeEventListener?: (t: string, l: () => void) => void;
    };
    target.addEventListener?.('online', check);
    target.addEventListener?.('offline', check);
    return () => {
      live = false;
      clearTimeout(timer);
      off();
      target.removeEventListener?.('online', check);
      target.removeEventListener?.('offline', check);
    };
  }, []);
  return gate;
}
