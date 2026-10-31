/**
 * Device settings on web (E01-S19): `localStorage`, under the keys the
 * settings have always used, so a value a phone already holds is still read
 * after the update (DS-2). See `device-settings.ts` for the contract.
 */

import type { DeviceSettings } from './device-settings';

export const deviceSettings: DeviceSettings = {
  get(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* a quota or privacy-mode error must not take the app down */
    }
  },
  // The web build is static-rendered: a value read during render would differ
  // between the server HTML and the first client render. Read after mount.
  readDuringRender: false,
};
