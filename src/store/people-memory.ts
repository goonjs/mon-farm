/**
 * `MemoryPeopleStore`, in its own file rather than inside `people.ts`.
 *
 * This is not a style choice. `people.native.ts` / `people.web.ts` shadow any
 * bare `./people` (or `../store/people`) specifier under React Native's
 * platform-extension resolution — and jest-expo applies that same resolution
 * inside `jest.requireActual`, not just inside Metro. Import directly from
 * here in anything that must run under Jest.
 *
 * Since E03-S01 it is simply `MasterStore` over a fresh `MemoryStore`.
 */

import { createDeviceClock } from './device-clock';
import { MasterStore } from './master-store';
import { MemoryStore } from './memory-store';

export class MemoryPeopleStore extends MasterStore {
  constructor(events = new MemoryStore()) {
    super(events, createDeviceClock(events));
  }
}
