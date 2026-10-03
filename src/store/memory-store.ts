import { compareEvents } from '../core/order';
import type { EventId, SaleEvent } from '../core/types';
import { uuidv7 } from '../lib/id';
import { checkAppend, type DeviceState } from './append-rule';
import type { EventStore } from './store';

/**
 * In-memory store. Used by tests, and as the fallback when no persistent
 * backend is available — the app stays usable, it just forgets.
 */
export class MemoryStore implements EventStore {
  private rows = new Map<EventId, SaleEvent>();
  private synced = new Set<EventId>();
  private state: DeviceState = { deviceId: uuidv7(), nextDeviceSeq: 1 };

  async append(event: SaleEvent): Promise<void> {
    const next = checkAppend(event, this.rows.get(event.id), this.state);
    if (!next) return;
    this.rows.set(event.id, event);
    this.state = next;
  }

  async load(saleId: string): Promise<SaleEvent[]> {
    return [...this.rows.values()].filter((e) => e.saleId === saleId).sort(compareEvents);
  }

  async pending(): Promise<SaleEvent[]> {
    return [...this.rows.values()]
      .filter((e) => !this.synced.has(e.id))
      .sort((a, b) => a.deviceSeq - b.deviceSeq);
  }

  async markSynced(ids: readonly EventId[]): Promise<void> {
    for (const id of ids) this.synced.add(id);
  }

  async listSales(): Promise<string[]> {
    const firstTs = new Map<string, number>();
    for (const e of this.rows.values()) {
      firstTs.set(e.saleId, Math.min(firstTs.get(e.saleId) ?? Infinity, e.ts));
    }
    return [...firstTs.keys()].sort((a, b) => firstTs.get(b)! - firstTs.get(a)!);
  }

  async device(): Promise<DeviceState> {
    return this.state;
  }

  async isDurable(): Promise<boolean> {
    return false;
  }
}
