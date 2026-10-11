/**
 * Starts and stops the sync engine for the signed-in user in the open group
 * (E01-S09). Platform-free: the app gives it the pieces (`use-sync.ts`), tests
 * give it fakes.
 *
 * Triggers, per architecture §Push: once at start (app open), when the network
 * comes back, and soon after every local write (debounced by the engine).
 * Nothing here is awaited by the app: counting, saving and every screen work
 * the same whether or not a sync is running, failing or never reaches the
 * server (D-3, offline-first).
 */

import type { Scope } from '../core/scope';
import type { AccountStore } from '../store/account';
import { SyncEngine, storeCursor, type SyncStore } from './engine';
import type { SyncRemote } from './client';
import type { EventStore } from '../store/store';

export interface SyncRuntimeDeps {
  readonly scope: Scope;
  readonly store: SyncStore & Pick<EventStore, 'syncCursor' | 'setSyncCursor' | 'syncCorrupt' | 'setSyncCorrupt'>;
  readonly accounts: Pick<AccountStore, 'pendingOps' | 'completeOp'>;
  readonly remote: SyncRemote;
  /** A local write happened; returns the unsubscribe. */
  readonly onAppended: (listener: () => void) => () => void;
  /** The network came back; returns the unsubscribe. */
  readonly onOnline: (listener: () => void) => () => void;
  /** A pull completed (the first one unlocks the points wizard). */
  readonly onPulled?: () => void;
  /** False while the device knows it has no network: an attempt would only wait out its timeout. */
  readonly isOnline: () => boolean;
}

export interface SyncHandle {
  readonly engine: SyncEngine;
  /** No more triggers and no more timers. Idempotent. */
  stop(): void;
}

export function startSync(deps: SyncRuntimeDeps): SyncHandle {
  const engine = new SyncEngine({
    store: deps.store,
    accounts: deps.accounts,
    scope: deps.scope,
    remote: deps.remote,
    cursor: storeCursor(deps.store, deps.scope.groupId),
    onPulled: deps.onPulled,
  });
  // A failed run has already scheduled its own retry; nothing to do with the rejection.
  const now = () => {
    if (deps.isOnline()) engine.sync().catch(() => undefined);
  };
  const unsubscribers = [
    deps.onAppended(() => {
      if (deps.isOnline()) engine.poke();
    }),
    deps.onOnline(now),
  ];
  now();
  let stopped = false;
  return {
    engine,
    stop() {
      if (stopped) return;
      stopped = true;
      for (const off of unsubscribers) off();
      engine.stop();
    },
  };
}
