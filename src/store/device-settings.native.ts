/**
 * Device settings on Android/iOS (E01-S19): expo-sqlite's own synchronous
 * key-value store (`expo-sqlite/kv-store`, part of expo-sqlite 57 — no new
 * dependency, DS-6). React Native has no `localStorage`, which is why these
 * settings used to be forgotten on every restart.
 *
 * Its own database file, not `mon-farm.db`: settings are not events, never
 * sync, and the sync engine never reads this file. Opened lazily on first use,
 * so a broken store costs the defaults (DS-5), not the app.
 */

import { SQLiteStorage } from 'expo-sqlite/kv-store';

import type { DeviceSettings } from './device-settings';

const DB_NAME = 'mon-farm-settings.db';

let storage: SQLiteStorage | null = null;
const open = () => (storage ??= new SQLiteStorage(DB_NAME));

export const deviceSettings: DeviceSettings = {
  get(key) {
    try {
      return open().getItemSync(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      open().setItemSync(key, value);
    } catch {
      /* a disk error must not take the app down; the choice just does not survive a restart */
    }
  },
  // No static render on native, and the read is synchronous: read in the
  // first render so a stored language or text size shows from frame one (DS-4).
  readDuringRender: true,
};
