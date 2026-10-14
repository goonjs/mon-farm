/**
 * Web sync client: Firestore on the Firebase JS SDK (E01-S09).
 *
 * The SDK's cache is memory-only, on purpose: our event store is the one
 * durable copy, and a second persistent copy in the browser would only drift
 * (architecture §Sync engine). Reads and writes are made as the signed-in
 * user's Firebase session, which the SDK restores from its own storage on
 * launch; if it has none the remote answers `unauthenticated` and the engine
 * keeps retrying, so the app never blocks on it.
 */

import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore';

import { authAvailable, firebaseApp, firebaseAuth, firestoreDatabaseId, firestoreEmulatorHost, syncAvailable } from '../auth/firebase-web';
import type { GroupId, UserId } from '../core/types';
import type { SyncRemote } from './client';
import { FirestoreMemberships, FirestoreRemote, whenSignedInAs } from './firestore-remote';
import { sdkLayer } from './firestore-sdk';
import type { RemoteMemberships } from './remote';

let db: Firestore | null = null;

function firestore(): Firestore {
  if (db) return db;
  db = initializeFirestore(firebaseApp(), { localCache: memoryLocalCache() }, firestoreDatabaseId);
  if (firestoreEmulatorHost) {
    const [host, port] = firestoreEmulatorHost.split(':');
    connectFirestoreEmulator(db, host, Number(port));
  }
  return db;
}

/** The layer that only talks to the server as the signed-in user (see `whenSignedInAs`), or null when this build cannot sync. */
function signedInLayer(userId: UserId) {
  if (!syncAvailable || !authAvailable) return null;
  const auth = firebaseAuth();
  const currentUid = async () => {
    await auth.authStateReady();
    return auth.currentUser?.uid ?? null;
  };
  return whenSignedInAs(sdkLayer(firestore()), currentUid, userId);
}

export async function connectRemote(userId: UserId, groupId: GroupId): Promise<SyncRemote | null> {
  const layer = signedInLayer(userId);
  return layer && new FirestoreRemote(layer, groupId, userId);
}

export async function connectMemberships(userId: UserId): Promise<RemoteMemberships | null> {
  const layer = signedInLayer(userId);
  return layer && new FirestoreMemberships(layer, userId);
}
