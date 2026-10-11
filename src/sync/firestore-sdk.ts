/**
 * `FirestoreLayer` on the Firebase JS SDK (E01-S09). The only file of the sync
 * code that touches `firebase/firestore`; everything it carries out is decided
 * in `firestore-remote.ts`. Proven against the emulator (`firestore/sync.test.ts`).
 *
 * Reads go to the server (`getDocFromServer`, `getDocsFromServer`): the SDK's
 * own cache must never answer for the server, because our event store is the
 * one durable copy (architecture §Sync engine).
 */

import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { SERVER_TIMESTAMP, type DocWrite, type FirestoreLayer } from './firestore-remote';

/** The server's stamp as epoch milliseconds; anything else (not yet stamped) is null. */
function readable(data: DocumentData): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  if ('receivedAt' in out) out.receivedAt = out.receivedAt instanceof Timestamp ? out.receivedAt.toMillis() : null;
  return out;
}

export function sdkLayer(db: Firestore): FirestoreLayer {
  return {
    async commit(writes: readonly DocWrite[]) {
      const batch = writeBatch(db);
      for (const w of writes) {
        const data: Record<string, unknown> = { ...w.data };
        for (const [key, value] of Object.entries(data)) if (value === SERVER_TIMESTAMP) data[key] = serverTimestamp();
        batch.set(doc(db, w.path), data);
      }
      await batch.commit();
    },

    async get(path) {
      const snap = await getDocFromServer(doc(db, path));
      return snap.exists() ? readable(snap.data()) : null;
    },

    async eventsSince(groupId, sinceMs) {
      const q = query(
        collection(db, 'groups', groupId, 'events'),
        where('receivedAt', '>=', Timestamp.fromMillis(sinceMs)),
        orderBy('receivedAt'),
      );
      return (await getDocsFromServer(q)).docs.map((d) => readable(d.data()));
    },
  };
}
