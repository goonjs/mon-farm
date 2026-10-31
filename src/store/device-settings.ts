/**
 * Where this device's own settings are kept (E01-S19) — text size, hold time,
 * count mode, short-basket mode, speech on/off, language and year system.
 * They belong to the DEVICE: not events, never synced, they do not follow the
 * user to another phone. See `docs/architecture.md` §ค่าตั้งของเครื่อง (ไม่ซิงก์).
 *
 * One synchronous get/set for both platforms: `device-settings.web.ts`
 * (localStorage, the keys unchanged) and `device-settings.native.ts`
 * (expo-sqlite kv-store). Metro picks the platform file; this file is what
 * `tsc`, Vitest and plain Node resolve a bare `./device-settings` to, and it
 * re-exports the web adapter for them, since they have no platform layer.
 *
 * Never throws: a missing or broken store reads as null (= the default) and
 * a failed write is dropped. Each caller still validates what it reads.
 */

export interface DeviceSettings {
  get(key: string): string | null;
  set(key: string, value: string): void;
  /**
   * Whether a value may be read during the first render. False on web (static
   * render: read after mount), true on native (so nothing flashes the default).
   */
  readonly readDuringRender: boolean;
}

export { deviceSettings } from './device-settings.web';
