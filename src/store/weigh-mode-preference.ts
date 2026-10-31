/**
 * Where this device remembers how a short basket is recorded (E04-S16).
 *
 * Like the hold time (`hold-preference.ts`) both belong to the DEVICE and never
 * sync. `mode`: type the numbers (default, owner 2026-10-13) or drag the dial.
 * `basis`: what the dial follows — the scale's reading (default) or the net
 * rubber. Anything stored that is not one of the known values is ignored.
 * Kept through `device-settings` so it survives a restart on Android (E01-S19).
 */

import { deviceSettings } from './device-settings';

export type WeighMode = 'type' | 'dial';
export type WeighBasis = 'scale' | 'net';

const MODE_KEY = 'mon-farm:weigh-mode';
const BASIS_KEY = 'mon-farm:weigh-basis';

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const v = deviceSettings.get(key);
  return (allowed as readonly string[]).includes(v ?? '') ? (v as T) : fallback;
}

function write<T extends string>(key: string, allowed: readonly T[], value: T): void {
  if (!(allowed as readonly string[]).includes(value)) return;
  deviceSettings.set(key, value);
}

const MODES = ['type', 'dial'] as const;
const BASES = ['scale', 'net'] as const;

export const readWeighMode = (): WeighMode => read(MODE_KEY, MODES, 'type');
export const writeWeighMode = (m: WeighMode): void => write(MODE_KEY, MODES, m);
export const readWeighBasis = (): WeighBasis => read(BASIS_KEY, BASES, 'scale');
export const writeWeighBasis = (b: WeighBasis): void => write(BASIS_KEY, BASES, b);
