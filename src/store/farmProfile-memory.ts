/**
 * `MemoryFarmProfileStore`, in its own file rather than inside
 * `farmProfile.ts` — the same jest-expo platform-resolution reason
 * `people-memory.ts` exists. See that file's header for the full story.
 */

import { DocFarmProfileStore, EMPTY_PROFILE } from './farmProfile-doc';
import type { FarmProfile } from './farmProfile';

/** In-memory. Used by tests, and the fallback when no persistent backend exists. */
export class MemoryFarmProfileStore extends DocFarmProfileStore {
  private doc: FarmProfile = EMPTY_PROFILE;

  protected async read(): Promise<FarmProfile> {
    return this.doc;
  }

  protected async write(profile: FarmProfile): Promise<void> {
    this.doc = profile;
  }
}
