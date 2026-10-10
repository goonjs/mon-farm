/**
 * Web binding of the people store: `MasterStore` over the IndexedDB event
 * store. S16's localStorage list (`mon-farm:people`) is not migrated (owner
 * 2026-10-03) and no longer read; it is left in place rather than cleared,
 * since clearing it cannot be undone.
 */

import { MasterStore } from './master-store';
import { deviceClock } from './record';
import { store } from './store';

export const peopleStore = new MasterStore(store, deviceClock);
