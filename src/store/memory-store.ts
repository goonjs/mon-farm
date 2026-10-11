import { compareEvents } from '../core/order';
import { MASTER_SCOPE } from '../core/master';
import type { EventId, GroupId, SaleEvent } from '../core/types';
import { uuidv7 } from '../lib/id';
import { checkAppend, checkPulled, type DeviceState } from './append-rule';
import { corruptFor, cursorFor, type StoredCorrupt, type StoredCursor } from './sync-cursor';
import type { EventStore } from './store';

/**
 * In-memory store. Used by tests, and as the fallback when no persistent
 * backend is available — the app stays usable, it just forgets.
 */
export class MemoryStore implements EventStore {
  private rows = new Map<EventId, SaleEvent>();
  private synced = new Set<EventId>();
  private cursor: StoredCursor | null = null;
  private corrupt: StoredCorrupt | null = null;
  private state: DeviceState = { deviceId: uuidv7(), nextDeviceSeq: 1 };

  async append(event: SaleEvent): Promise<void> {
    const result = checkAppend(event, this.rows.get(event.id), this.state);
    if (!result) return;
    this.rows.set(event.id, result.event);
    this.state = result.device;
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

  async insertPulled(event: SaleEvent): Promise<void> {
    if (checkPulled(event, this.rows.get(event.id))) this.rows.set(event.id, event);
    this.synced.add(event.id);
  }

  async syncCursor(groupId: GroupId): Promise<number> {
    return cursorFor(this.cursor, groupId);
  }

  async setSyncCursor(groupId: GroupId, value: number): Promise<void> {
    this.cursor = { groupId, value };
  }

  async syncCorrupt(groupId: GroupId): Promise<EventId[]> {
    return corruptFor(this.corrupt, groupId);
  }

  async setSyncCorrupt(groupId: GroupId, ids: readonly EventId[]): Promise<void> {
    this.corrupt = { groupId, ids: [...ids] };
  }

  async listSales(): Promise<string[]> {
    const firstTs = new Map<string, number>();
    for (const e of this.rows.values()) {
      if (e.saleId === MASTER_SCOPE) continue;
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
