/**
 * Native binding of the people store: `MasterStore` over the expo-sqlite
 * event store. S16's `people` table in `mon-farm.db` is no longer read
 * (owner 2026-10-03: start fresh); that file still holds S27's farm profile
 * until E03-S02/S03 replace it, so it is left alone here.
 */

import { MasterStore } from './master-store';
import { deviceClock } from './record';
import { store } from './store';

export const peopleStore = new MasterStore(store, deviceClock);
