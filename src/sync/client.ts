/**
 * The sync client port (E01-S09): how the app gets a connection to the backend
 * for one signed-in user in one group.
 *
 *   client.web.ts    — Firebase JS SDK (Firestore, memory cache) on the shared
 *                      app and Auth of `src/auth/firebase-web.ts`
 *   client.native.ts — not built: Android sync waits for the dev client (E01-S06)
 *
 * Resolves `null` when this build cannot sync at all (no Firebase config and no
 * emulator, or a platform without an adapter): the app then simply stays
 * local, which is the normal offline-first state, not an error.
 */

import type { GroupId, UserId } from '../core/types';
import type { RemoteEvents, RemoteGroups } from './remote';

export type SyncRemote = RemoteEvents & RemoteGroups;

/** Ambient declaration only — see the matching note in `src/store/store.ts`. */
export declare const connectRemote: (userId: UserId, groupId: GroupId) => Promise<SyncRemote | null>;
