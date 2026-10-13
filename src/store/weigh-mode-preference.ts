/**
 * Where this device remembers how a short basket is recorded (E04-S16).
 *
 * Like the hold time (`hold-preference.ts`) both belong to the DEVICE and never
 * sync. `mode`: type the numbers (default, owner 2026-10-13) or drag the dial.
 * `basis`: what the dial follows — the scale's reading (default) or the net
 * rubber. Anything stored that is not one of the known values is ignored.
 */

export type WeighMode = 'type' | 'dial';
export type WeighBasis = 'scale' | 'net';

const MODE_KEY = 'mon-farm:weigh-mode';
const BASIS_KEY = 'mon-farm:weigh-basis';

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = globalThis.localStorage?.getItem(key);
    return (allowed as readonly string[]).includes(v ?? '') ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T extends string>(key: string, allowed: readonly T[], value: T): void {
  if (!(allowed as readonly string[]).includes(value)) return;
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* a quota or privacy-mode error must not take the app down */
  }
}

const MODES = ['type', 'dial'] as const;
const BASES = ['scale', 'net'] as const;

export const readWeighMode = (): WeighMode => read(MODE_KEY, MODES, 'type');
export const writeWeighMode = (m: WeighMode): void => write(MODE_KEY, MODES, m);
export const readWeighBasis = (): WeighBasis => read(BASIS_KEY, BASES, 'scale');
export const writeWeighBasis = (b: WeighBasis): void => write(BASIS_KEY, BASES, b);
