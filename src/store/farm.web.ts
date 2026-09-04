/**
 * Web farm profile store. Same localStorage trade-off as `people.web.ts`:
 * this is the verification surface, not the field surface, so simplicity
 * wins over write efficiency. One JSON document holds the whole profile —
 * there is no per-zone key, because the profile is small and always read and
 * written as a unit.
 */

import { newId } from '../lib/id';
import type { PileId, ZoneId } from '../core/types';
import type { FarmStore, ProfilePile, ProfileZone } from './farm';

const KEY = 'mon-farm:farm-profile';

function read(): ProfileZone[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProfileZone[]) : [];
  } catch {
    return [];
  }
}

function write(rows: ProfileZone[]): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* a quota error must not take the app down */
  }
}

export class WebFarmStore implements FarmStore {
  async listZones(): Promise<ProfileZone[]> {
    return read()
      .filter((z) => z.archivedTs === null)
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }

  async getZone(id: ZoneId): Promise<ProfileZone | null> {
    return read().find((z) => z.id === id) ?? null;
  }

  async addZone(name: string): Promise<ProfileZone> {
    const zone: ProfileZone = { id: newId('zone-'), name, piles: [], archivedTs: null };
    write([...read(), zone]);
    return zone;
  }

  async renameZone(id: ZoneId, name: string): Promise<void> {
    write(read().map((z) => (z.id === id ? { ...z, name } : z)));
  }

  async archiveZone(id: ZoneId): Promise<void> {
    write(read().map((z) => (z.id === id ? { ...z, archivedTs: Date.now() } : z)));
  }

  async addPile(zoneId: ZoneId, name: string, tareG: number, stdNetG: number): Promise<ProfilePile> {
    const pile: ProfilePile = { id: newId('pile-'), name, tareG, stdNetG };
    write(read().map((z) => (z.id === zoneId ? { ...z, piles: [...z.piles, pile] } : z)));
    return pile;
  }

  async editPile(
    zoneId: ZoneId,
    pileId: PileId,
    patch: Partial<Pick<ProfilePile, 'name' | 'tareG' | 'stdNetG'>>,
  ): Promise<void> {
    write(
      read().map((z) =>
        z.id === zoneId
          ? { ...z, piles: z.piles.map((p) => (p.id === pileId ? { ...p, ...patch } : p)) }
          : z,
      ),
    );
  }

  async removePile(zoneId: ZoneId, pileId: PileId): Promise<void> {
    write(
      read().map((z) => (z.id === zoneId ? { ...z, piles: z.piles.filter((p) => p.id !== pileId) } : z)),
    );
  }
}

export const farmStore: FarmStore = new WebFarmStore();
