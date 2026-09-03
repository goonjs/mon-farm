/**
 * `MemoryFarmStore`, in its own file rather than inside `farm.ts`.
 *
 * This is not a style choice. `farm.native.ts` / `farm.web.ts` shadow any
 * bare `./farm` (or `../store/farm`) specifier under React Native's
 * platform-extension resolution — and jest-expo applies that same resolution
 * inside `jest.requireActual`, not just inside Metro. A test importing
 * `MemoryFarmStore` from `./farm` under Jest silently receives whichever
 * platform adapter jest defaults to instead of the base file, and the class
 * it's looking for isn't there. Vitest has no such platform layer, so the
 * same import works fine there — which is exactly the kind of
 * test-runner-dependent behaviour that is worth naming a file to avoid rather
 * than working around at every call site.
 *
 * `farm.ts` re-exports this for convenience; import directly from here in
 * anything that must run under Jest.
 */

import { newId } from '../lib/id';
import type { PileId, ZoneId } from '../core/types';
import type { FarmStore, ProfilePile, ProfileZone } from './farm';

/** In-memory. Used by tests and as the fallback when no persistent backend is available. */
export class MemoryFarmStore implements FarmStore {
  private rows = new Map<ZoneId, ProfileZone>();

  async listZones(): Promise<ProfileZone[]> {
    return [...this.rows.values()]
      .filter((z) => z.archivedTs === null)
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }

  async getZone(id: ZoneId): Promise<ProfileZone | null> {
    return this.rows.get(id) ?? null;
  }

  async addZone(name: string): Promise<ProfileZone> {
    const zone: ProfileZone = { id: newId('zone-'), name, piles: [], archivedTs: null };
    this.rows.set(zone.id, zone);
    return zone;
  }

  async renameZone(id: ZoneId, name: string): Promise<void> {
    const z = this.rows.get(id);
    if (z) this.rows.set(id, { ...z, name });
  }

  async archiveZone(id: ZoneId): Promise<void> {
    const z = this.rows.get(id);
    if (z) this.rows.set(id, { ...z, archivedTs: Date.now() });
  }

  async addPile(zoneId: ZoneId, name: string, tareG: number, stdNetG: number): Promise<ProfilePile> {
    const z = this.rows.get(zoneId);
    const pile: ProfilePile = { id: newId('pile-'), name, tareG, stdNetG };
    if (z) this.rows.set(zoneId, { ...z, piles: [...z.piles, pile] });
    return pile;
  }

  async editPile(
    zoneId: ZoneId,
    pileId: PileId,
    patch: Partial<Pick<ProfilePile, 'name' | 'tareG' | 'stdNetG'>>,
  ): Promise<void> {
    const z = this.rows.get(zoneId);
    if (!z) return;
    this.rows.set(zoneId, {
      ...z,
      piles: z.piles.map((p) => (p.id === pileId ? { ...p, ...patch } : p)),
    });
  }

  async removePile(zoneId: ZoneId, pileId: PileId): Promise<void> {
    const z = this.rows.get(zoneId);
    if (!z) return;
    this.rows.set(zoneId, { ...z, piles: z.piles.filter((p) => p.id !== pileId) });
  }
}
