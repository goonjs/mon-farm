/**
 * The farm profile's logic, once, over a document the adapters only store.
 *
 * Two things force this file to exist rather than living in `farmProfile.ts`:
 *
 *  1. `farmProfile.web.ts` / `farmProfile.native.ts` shadow every bare
 *     `./farmProfile` specifier under React Native's (and jest-expo's)
 *     platform-extension resolution, so a runtime value exported from the base
 *     file cannot be imported by anything that also runs under Metro or Jest.
 *     Types are erased and so are safe there; classes and functions are not.
 *     Same reason `people-memory.ts` is its own file.
 *  2. Three adapters implementing eight mutators each would be the same
 *     read-modify-write logic written three times, with three chances to get
 *     the seeding rule wrong. Here the adapters implement `read`/`write` and
 *     nothing else.
 *
 * The profile is stored as ONE document rather than relational rows — unlike
 * `people`, which is listed, sorted and looked up by id. Nothing queries a
 * profile: it is read whole when a screen opens and written whole when the
 * owner changes something, it is a handful of zones, and `establishedTs` has
 * to stay consistent with the zone list it describes. A single document is the
 * simplest thing that is correct here (KISS), and it keeps the SQLite adapter
 * to one row.
 */

import { newId } from '../lib/id';
import type { FarmProfile, FarmProfileStore, ProfilePile, ProfileZone } from './farmProfile';
import type { Pile, Zone } from '../core/types';

export const EMPTY_PROFILE: FarmProfile = { zones: [], establishedTs: null };

/**
 * A past sale's live zones and piles, as profile zones.
 *
 * Removed zones and piles (S26) are left out: they were retired from that
 * sale on purpose, and offering them again next sale would be the app
 * remembering a decision the owner already made against. The contract
 * (worker, split) is left out too — see `farmProfile.ts`.
 */
export function profileZonesFromSale(
  zones: readonly Zone[],
  piles: readonly Pile[],
): ProfileZone[] {
  return zones
    .filter((z) => !z.removed)
    .map((z) => ({
      id: newId('pzone-'),
      name: z.name,
      piles: piles
        .filter((p) => p.zoneId === z.id && !p.removed)
        .map((p) => ({ id: newId('ppile-'), name: p.name, tareG: p.tareG, stdNetG: p.stdNetG })),
    }));
}

/**
 * Every mutator, expressed as read → transform → write. Adapters supply the
 * two ends.
 */
export abstract class DocFarmProfileStore implements FarmProfileStore {
  protected abstract read(): Promise<FarmProfile>;
  protected abstract write(profile: FarmProfile): Promise<void>;

  async get(): Promise<FarmProfile> {
    return this.read();
  }

  private async update(f: (p: FarmProfile) => FarmProfile): Promise<void> {
    const before = await this.read();
    await this.write(f(before));
  }

  async addZone(name: string): Promise<ProfileZone> {
    const zone: ProfileZone = { id: newId('pzone-'), name, piles: [] };
    // Adding the first zone by hand ESTABLISHES the profile, exactly as a seed
    // would. Without this, a profile the owner typed themselves and later
    // emptied is indistinguishable from one that never existed, and the next
    // visit to this screen re-seeds it from the last sale — the app overruling
    // a decision the owner just made, which is the failure mode S27 exists to
    // prevent. (QA, 2026-09-03.)
    await this.update((p) => ({
      ...p,
      zones: [...p.zones, zone],
      establishedTs: p.establishedTs ?? Date.now(),
    }));
    return zone;
  }

  async renameZone(id: string, name: string): Promise<void> {
    await this.update((p) => ({
      ...p,
      zones: p.zones.map((z) => (z.id === id ? { ...z, name } : z)),
    }));
  }

  async removeZone(id: string): Promise<void> {
    await this.update((p) => ({ ...p, zones: p.zones.filter((z) => z.id !== id) }));
  }

  async addPile(
    zoneId: string,
    pile: { name: string; tareG: number; stdNetG: number },
  ): Promise<ProfilePile | null> {
    const before = await this.read();
    if (!before.zones.some((z) => z.id === zoneId)) return null;
    const added: ProfilePile = { id: newId('ppile-'), ...pile };
    await this.write({
      ...before,
      zones: before.zones.map((z) => (z.id === zoneId ? { ...z, piles: [...z.piles, added] } : z)),
    });
    return added;
  }

  async editPile(
    pileId: string,
    patch: Partial<{ name: string; tareG: number; stdNetG: number }>,
  ): Promise<void> {
    await this.update((p) => ({
      ...p,
      zones: p.zones.map((z) => ({
        ...z,
        piles: z.piles.map((pile) => (pile.id === pileId ? { ...pile, ...patch } : pile)),
      })),
    }));
  }

  async removePile(pileId: string): Promise<void> {
    await this.update((p) => ({
      ...p,
      zones: p.zones.map((z) => ({ ...z, piles: z.piles.filter((pile) => pile.id !== pileId) })),
    }));
  }

  async seed(zones: readonly ProfileZone[]): Promise<void> {
    const before = await this.read();
    // Two separate guards, both required by S27's acceptance criteria: a
    // profile with zones in it is already the owner's, and a profile that once
    // existed — seeded or typed by hand — and was then emptied stays empty.
    if (before.establishedTs !== null || before.zones.length > 0) return;
    await this.write({ zones: [...zones], establishedTs: Date.now() });
  }
}
