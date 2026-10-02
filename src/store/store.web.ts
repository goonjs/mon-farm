/**
 * Web persistence. Metro resolves this file on web; `store.native.ts` is used
 * on device.
 *
 * localStorage for now; E01-S03 replaces it with IndexedDB now that web is a
 * real surface (D-19). Until then the trade stands: no async schema, no
 * cross-origin isolation, and a whole-sale rewrite per append that is fine at
 * demo scale and wrong for a 400-basket sale on a phone — which is why the
 * native adapter uses SQLite with a per-row INSERT.
 *
 * Keys live under `mon-farm-v1:` (E01-S02): the v0.4 log is not migrated
 * (owner 2026-10-03), so new code never reads the old shape and cannot crash
 * on it. The old sale keys are removed once, best-effort.
 */

import { checkAppend, type DeviceState } from './append-rule';
import type { EventStore } from './store';
import { compareEvents } from '../core/order';
import type { EventId, SaleEvent } from '../core/types';
import { uuidv7 } from '../lib/id';

const PREFIX = 'mon-farm-v1:';
const EVENTS = (saleId: string) => `${PREFIX}events:${saleId}`;
const SALES = `${PREFIX}sales`;
const SYNCED = `${PREFIX}synced`;
const META = `${PREFIX}meta`;

interface Meta extends DeviceState {
  readonly legacyCleanupV1: boolean;
}

/** v0.4 sale-log keys (architecture §ข้อมูลเก่า). Farm/people keys stay until E03. */
const LEGACY_EXACT = ['mon-farm:sales', 'mon-farm:synced', 'mon-farm:locale'];
const LEGACY_PREFIX = 'mon-farm:events:';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // A quota error or disabled storage must not take the app down: counting
    // matters more than remembering.
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch (err) {
    // See read(): never fatal — but never silent either.
    console.warn(`Could not write ${key}.`, err);
  }
}

/** Best-effort: a failure is logged and the app carries on without the old data. */
export function cleanUpLegacy(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    if (!storage) return;
    const doomed: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && (key.startsWith(LEGACY_PREFIX) || LEGACY_EXACT.includes(key))) doomed.push(key);
    }
    for (const key of doomed) storage.removeItem(key);
  } catch (err) {
    console.warn('Legacy v0.4 cleanup failed; continuing without it.', err);
  }
}

export class WebStore implements EventStore {
  /** Reads (and on first use, creates) this browser profile's device record. */
  private meta(): Meta {
    const stored = read<Meta | null>(META, null);
    if (stored?.legacyCleanupV1) return stored;
    cleanUpLegacy();
    const meta: Meta = {
      deviceId: stored?.deviceId ?? uuidv7(),
      nextDeviceSeq: stored?.nextDeviceSeq ?? 1,
      legacyCleanupV1: true,
    };
    write(META, meta);
    return meta;
  }

  // Synchronous from start to finish once called, so two appends fired
  // back-to-back can never interleave their read-check-write.
  async append(event: SaleEvent): Promise<void> {
    const meta = this.meta();
    const list = read<SaleEvent[]>(EVENTS(event.saleId), []);
    const next = checkAppend(event, list.find((e) => e.id === event.id), meta);
    if (!next) return;

    // Sequence first: if the event write then fails, a number is burned,
    // never handed out twice.
    write(META, { ...meta, ...next });
    list.push(event);
    write(EVENTS(event.saleId), list);

    const index = read<string[]>(SALES, []);
    if (!index.includes(event.saleId)) write(SALES, [event.saleId, ...index]);
  }

  async load(saleId: string): Promise<SaleEvent[]> {
    this.meta();
    return read<SaleEvent[]>(EVENTS(saleId), []).sort(compareEvents);
  }

  async pending(): Promise<SaleEvent[]> {
    const synced = new Set(read<EventId[]>(SYNCED, []));
    const out: SaleEvent[] = [];
    for (const saleId of read<string[]>(SALES, [])) {
      for (const e of read<SaleEvent[]>(EVENTS(saleId), [])) {
        if (!synced.has(e.id)) out.push(e);
      }
    }
    return out.sort((a, b) => a.deviceSeq - b.deviceSeq);
  }

  async markSynced(ids: readonly EventId[]): Promise<void> {
    const synced = new Set(read<EventId[]>(SYNCED, []));
    for (const id of ids) synced.add(id);
    write(SYNCED, [...synced]);
  }

  async listSales(): Promise<string[]> {
    // Also the first call on the sale list: the one-time legacy cleanup runs
    // here even if no sale is ever opened.
    this.meta();
    return read<string[]>(SALES, []);
  }

  async device(): Promise<DeviceState> {
    const { deviceId, nextDeviceSeq } = this.meta();
    return { deviceId, nextDeviceSeq };
  }
}

export const store: EventStore = new WebStore();
