/**
 * The web app's one IndexedDB database, `mon-farm-v1` (architecture §Schema
 * — เว็บ), shared by the event store (`store.web.ts`) and the account store
 * (`account.web.ts`). Each module opens its own connection and touches only
 * its own object stores; the schema lives here so both open the same version
 * and an upgrade creates everything at once.
 *
 * Plain data plus two helpers and no browser global at import time, so the
 * e2e session preload (`e2e/session.ts`) builds its database from the same
 * description the app upgrades from.
 *
 *   v1 (E01-S03) — `events`, `meta`
 *   v2 (E02-S02) — `memberships` (keyPath `groupId`), `pendingOps`
 *                  (key `${op}:${groupId}`, as `pending_ops.id` on native)
 */

export const DB_NAME = 'mon-farm-v1';
export const DB_VERSION = 2;

export interface StoreSpec {
  readonly name: string;
  /** Absent = out-of-line keys, given on each put. */
  readonly keyPath?: string;
  readonly indexes: readonly { readonly name: string; readonly keyPath: string }[];
}

export const STORES: readonly StoreSpec[] = [
  {
    name: 'events',
    keyPath: 'id',
    indexes: [
      { name: 'saleId', keyPath: 'saleId' },
      { name: 'pending', keyPath: 'pending' },
    ],
  },
  { name: 'meta', indexes: [] },
  { name: 'memberships', keyPath: 'groupId', indexes: [] },
  { name: 'pendingOps', indexes: [] },
];

export function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

/** Opens the database, creating whichever object stores this version adds. */
export function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = factory.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const spec of STORES) {
        if (db.objectStoreNames.contains(spec.name)) continue;
        const store = db.createObjectStore(spec.name, spec.keyPath ? { keyPath: spec.keyPath } : undefined);
        for (const index of spec.indexes) store.createIndex(index.name, index.keyPath);
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
    // Another tab holds an older version open; it closes on `versionchange`.
    open.onblocked = () => console.warn('IndexedDB upgrade blocked by another tab.');
  });
}

/**
 * A lazily opened connection that reopens after the browser drops it (Safari
 * does on backgrounded tabs) or another tab upgrades the database.
 */
export function connection(
  factory: () => IDBFactory | undefined,
  init?: (db: IDBDatabase) => Promise<void>,
): () => Promise<IDBDatabase> {
  let db: Promise<IDBDatabase> | null = null;
  return () => {
    db ??= (async () => {
      const f = factory();
      if (!f) throw new Error('IndexedDB is not available.');
      const opened = await openDb(f);
      opened.onclose = () => {
        db = null;
      };
      opened.onversionchange = () => {
        opened.close();
        db = null;
      };
      try {
        await init?.(opened);
      } catch (err) {
        opened.close();
        throw err;
      }
      return opened;
    })().catch((err) => {
      db = null;
      throw err;
    });
    return db;
  };
}
