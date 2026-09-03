/**
 * Web farm profile: one localStorage key holding the whole document. Same
 * trade-off as `store.web.ts` and `people.web.ts` — this is the verification
 * surface, not the field surface, so simplicity wins.
 */

import { DocFarmProfileStore, EMPTY_PROFILE } from './farmProfile-doc';
import type { FarmProfile, FarmProfileStore } from './farmProfile';

const KEY = 'mon-farm:farm-profile';

export class WebFarmProfileStore extends DocFarmProfileStore {
  protected async read(): Promise<FarmProfile> {
    try {
      const raw = globalThis.localStorage?.getItem(KEY);
      if (!raw) return EMPTY_PROFILE;
      const doc = JSON.parse(raw) as Partial<FarmProfile>;
      return { zones: doc.zones ?? [], seededTs: doc.seededTs ?? null };
    } catch {
      return EMPTY_PROFILE;
    }
  }

  protected async write(profile: FarmProfile): Promise<void> {
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(profile));
    } catch {
      /* a quota error must not take the app down */
    }
  }
}

export const farmProfileStore: FarmProfileStore = new WebFarmProfileStore();
