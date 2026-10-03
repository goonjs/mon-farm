/**
 * Web persistence: IndexedDB. Metro resolves this file on web;
 * `store.native.ts` is used on device.
 *
 * Web is a real surface now (D-19), so the localStorage stopgap is gone: one
 * append writes one record, inside one `readwrite` transaction over `events`
 * and `meta`, so the device-sequence check and the insert commit together —
 * and IndexedDB serialises overlapping readwrite transactions across tabs.
 *
 * Database `mon-farm-v1` (architecture §Schema — เว็บ). The v0.4 log in
 * localStorage is not migrated (owner 2026-10-03); its sale keys are removed
 * once, best-effort. Where IndexedDB is unavailable (some private modes) the
 * app falls back to memory and says so (`isDurable`).
 */

import { checkAppend, type DeviceState } from './append-rule';
import { markNotDurable } from './durability';
import { IntegrityError } from './errors';
import { MemoryStore } from './memory-store';
import type { EventStore } from './store';
import { compareEvents } from '../core/order';
import type { EventId, SaleEvent } from '../core/types';
import { uuidv7 } from '../lib/id';

const DB_NAME = 'mon-farm-v1';
const DB_VERSION = 1;

/**
 * One row per event. `pending` is 1|0 rather than a nullable `syncedAt`
 * because IndexedDB cannot index null — it is the outbox index.
 */
interface EventRecord {
  readonly id: EventId;
  readonly saleId: string;
  readonly ts: number;
  readonly deviceSeq: number;
  readonly pending: 0 | 1;
  readonly event: SaleEvent;
}

interface Meta extends DeviceState {
  readonly legacyCleanupV1: boolean;
}

/**
 * v0.4 sale-log keys (architecture §ข้อมูลเก่า), plus the `mon-farm-v1:`
 * localStorage keys E01-S02 used briefly on dev builds. Farm/people keys stay
 * until E03.
 */
const LEGACY_EXACT = ['mon-farm:sales', 'mon-farm:synced', 'mon-farm:locale'];
const LEGACY_PREFIXES = ['mon-farm:events:', 'mon-farm-v1:'];

/** Best-effort: a failure is logged and the app carries on without the old data. */
export function cleanUpLegacy(given?: Storage): void {
  try {
    // Read inside the try: the getter itself throws where storage is blocked.
    const storage = given ?? globalThis.localStorage;
    if (!storage) return;
    const doomed: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && (LEGACY_EXACT.includes(key) || LEGACY_PREFIXES.some((p) => key.startsWith(p)))) {
        doomed.push(key);
      }
    }
    for (const key of doomed) storage.removeItem(key);
  } catch (err) {
    console.warn('Legacy v0.4 cleanup failed; continuing without it.', err);
  }
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = factory.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      const events = db.createObjectStore('events', { keyPath: 'id' });
      events.createIndex('saleId', 'saleId');
      events.createIndex('pending', 'pending');
      db.createObjectStore('meta');
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
    // Another tab holds an older version open; nothing to do but wait.
    open.onblocked = () => console.warn('IndexedDB upgrade blocked by another tab.');
  });
}

export class IndexedDbStore implements EventStore {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory) {}

  private open(): Promise<IDBDatabase> {
    this.db ??= (async () => {
      const db = await openDb(this.factory);
      // The browser can drop the connection (Safari does on backgrounded
      // tabs). Reopen on next use rather than failing every write after.
      db.onclose = () => {
        this.db = null;
      };
      db.onversionchange = () => {
        db.close();
        this.db = null;
      };
      try {
        await this.ensureMeta(db);
      } catch (err) {
        db.close();
        this.db = null;
        throw err;
      }
      // Best-effort: asks the browser not to evict this origin's data.
      void globalThis.navigator?.storage?.persist?.().catch(() => undefined);
      return db;
    })();
    return this.db;
  }

  /** Mints the device id and runs the one-time legacy cleanup, once per profile. */
  private async ensureMeta(db: IDBDatabase): Promise<void> {
    const tx = db.transaction('meta', 'readwrite');
    const store = tx.objectStore('meta');
    const meta = (await request(store.get('device'))) as Meta | undefined;
    if (!meta?.legacyCleanupV1) {
      cleanUpLegacy();
      store.put(
        {
          deviceId: meta?.deviceId ?? uuidv7(),
          nextDeviceSeq: meta?.nextDeviceSeq ?? 1,
          legacyCleanupV1: true,
        } satisfies Meta,
        'device',
      );
    }
    await committed(tx);
  }

  async append(event: SaleEvent): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(['events', 'meta'], 'readwrite');
    const events = tx.objectStore('events');
    const metaStore = tx.objectStore('meta');
    const done = committed(tx);
    try {
      const [meta, existing] = await Promise.all([
        request(metaStore.get('device')) as Promise<Meta>,
        request(events.get(event.id)) as Promise<EventRecord | undefined>,
      ]);
      const next = checkAppend(event, existing?.event, meta);
      if (next) {
        events.add({
          id: event.id,
          saleId: event.saleId,
          ts: event.ts,
          deviceSeq: event.deviceSeq,
          pending: 1,
          event,
        } satisfies EventRecord);
        if (next !== meta) metaStore.put({ ...meta, ...next }, 'device');
      }
    } catch (err) {
      tx.abort();
      await done.catch(() => undefined);
      throw err;
    }
    await done;
  }

  async load(saleId: string): Promise<SaleEvent[]> {
    const db = await this.open();
    const tx = db.transaction('events', 'readonly');
    const rows = (await request(tx.objectStore('events').index('saleId').getAll(saleId))) as EventRecord[];
    return rows.map((r) => r.event).sort(compareEvents);
  }

  async pending(): Promise<SaleEvent[]> {
    const db = await this.open();
    const tx = db.transaction('events', 'readonly');
    const rows = (await request(tx.objectStore('events').index('pending').getAll(1))) as EventRecord[];
    return rows.map((r) => r.event).sort((a, b) => a.deviceSeq - b.deviceSeq);
  }

  async markSynced(ids: readonly EventId[]): Promise<void> {
    if (!ids.length) return;
    const db = await this.open();
    const tx = db.transaction('events', 'readwrite');
    const events = tx.objectStore('events');
    const done = committed(tx);
    try {
      for (const id of ids) {
        const row = (await request(events.get(id))) as EventRecord | undefined;
        if (row?.pending) events.put({ ...row, pending: 0 } satisfies EventRecord);
      }
    } catch (err) {
      await done.catch(() => undefined);
      throw err;
    }
    await done;
  }

  async listSales(): Promise<string[]> {
    const db = await this.open();
    const tx = db.transaction('events', 'readonly');
    const rows = (await request(tx.objectStore('events').getAll())) as EventRecord[];
    const firstTs = new Map<string, number>();
    for (const r of rows) firstTs.set(r.saleId, Math.min(firstTs.get(r.saleId) ?? Infinity, r.ts));
    return [...firstTs.keys()].sort((a, b) => firstTs.get(b)! - firstTs.get(a)!);
  }

  async device(): Promise<DeviceState> {
    const db = await this.open();
    const meta = (await request(db.transaction('meta', 'readonly').objectStore('meta').get('device'))) as Meta;
    return { deviceId: meta.deviceId, nextDeviceSeq: meta.nextDeviceSeq };
  }

  async isDurable(): Promise<boolean> {
    return true;
  }
}

/**
 * IndexedDB when the browser can open it; otherwise memory, which keeps
 * counting possible and reports itself as not durable so the UI can warn.
 */
async function chooseStore(): Promise<EventStore> {
  try {
    // Inside the try: in a sandboxed frame the getter itself throws.
    const factory = globalThis.indexedDB;
    if (factory) {
      const idb = new IndexedDbStore(factory);
      await idb.device();
      return idb;
    }
  } catch (err) {
    console.warn('IndexedDB unavailable; recording in memory only.', err);
  }
  return new MemoryStore();
}

/**
 * The adapter the app uses: picks a backing store once, on first use, and
 * turns any storage failure after that into the live not-durable signal.
 */
export class WebStore implements EventStore {
  private chosen: Promise<EventStore> | null = null;

  /** `choose` is for tests; the app uses the IndexedDB-or-memory probe. */
  constructor(private readonly choose: () => Promise<EventStore> = chooseStore) {}

  private pick(): Promise<EventStore> {
    this.chosen ??= this.choose();
    return this.chosen;
  }

  async append(event: SaleEvent) {
    const store = await this.pick();
    try {
      await store.append(event);
    } catch (err) {
      // A refused append (IntegrityError) is the log protecting itself; any
      // other failure means storage has stopped keeping what is counted.
      if (!(err instanceof IntegrityError)) markNotDurable(err);
      throw err;
    }
  }
  async load(saleId: string) {
    return (await this.pick()).load(saleId);
  }
  async pending() {
    return (await this.pick()).pending();
  }
  async markSynced(ids: readonly EventId[]) {
    return (await this.pick()).markSynced(ids);
  }
  async listSales() {
    return (await this.pick()).listSales();
  }
  async device() {
    return (await this.pick()).device();
  }
  async isDurable() {
    return (await this.pick()).isDurable();
  }
}

export const store: EventStore = new WebStore();
