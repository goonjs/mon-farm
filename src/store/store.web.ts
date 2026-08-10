/**
 * Web persistence. Metro resolves this file on web; `store.native.ts` is used
 * on device.
 *
 * localStorage, deliberately — not IndexedDB and emphatically not expo-sqlite.
 *
 * The web build is the verification surface, not the field surface. What it has
 * to do is survive a reload so Playwright can prove state persists, and be
 * impossible to break in a way that blocks the build. localStorage does that in
 * forty lines with no async schema, no version migrations, and no cross-origin
 * isolation requirements.
 *
 * The write-amplification criticism levelled at AsyncStorage in
 * `docs/architecture.md` applies here too: this rewrites the whole log on every
 * append. That is the wrong shape for a device holding a 400-basket sale, which
 * is exactly why the native adapter uses SQLite with a per-row INSERT. On web,
 * where a lost demo costs nothing, it is the right trade.
 */

import { DuplicateSeqError, type EventStore } from './store';
import type { SaleEvent } from '../core/types';

const KEY = (saleId: string) => `mon-farm:events:${saleId}`;
const SYNCED = 'mon-farm:synced';
const INDEX = 'mon-farm:sales';

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
  } catch {
    /* see read() */
  }
}

export class WebStore implements EventStore {
  async append(event: SaleEvent): Promise<void> {
    const list = read<SaleEvent[]>(KEY(event.saleId), []);
    if (list.some((e) => e.seq === event.seq)) {
      throw new DuplicateSeqError(event.saleId, event.seq);
    }
    list.push(event);
    write(KEY(event.saleId), list);

    const index = read<string[]>(INDEX, []);
    if (!index.includes(event.saleId)) write(INDEX, [event.saleId, ...index]);
  }

  async load(saleId: string): Promise<SaleEvent[]> {
    return read<SaleEvent[]>(KEY(saleId), []).sort((a, b) => a.seq - b.seq);
  }

  async pending(): Promise<SaleEvent[]> {
    const synced = new Set(read<string[]>(SYNCED, []));
    const out: SaleEvent[] = [];
    for (const saleId of read<string[]>(INDEX, [])) {
      for (const e of await this.load(saleId)) {
        if (!synced.has(`${saleId}#${e.seq}`)) out.push(e);
      }
    }
    return out;
  }

  async markSynced(saleId: string, seqs: readonly number[]): Promise<void> {
    const synced = new Set(read<string[]>(SYNCED, []));
    for (const seq of seqs) synced.add(`${saleId}#${seq}`);
    write(SYNCED, [...synced]);
  }

  async listSales(): Promise<string[]> {
    return read<string[]>(INDEX, []);
  }
}

export const store: EventStore = new WebStore();
