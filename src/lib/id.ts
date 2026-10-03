/**
 * Globally unique ids: UUIDv7 (RFC 9562, owner 2026-10-03).
 *
 * Ids must be unique across devices now that two offline phones can each
 * create records. v7 puts a millisecond timestamp first so ids minted close
 * together sort close together (index locality, readable logs) — but that
 * timestamp comes from the device clock, so NOTHING may order or decide by it.
 * The other 74 bits come from a CSPRNG; see `./random` for why there is no
 * fallback.
 */

// Bare specifier: Metro resolves random.native.ts on device, random.ts elsewhere.
import { randomBytes } from './random';

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

export function uuidv7(now: number = Date.now()): string {
  const b = new Uint8Array(16);
  // 48-bit big-endian millisecond timestamp. Split because bitwise ops are 32-bit.
  const high = Math.floor(now / 2 ** 16);
  b[0] = (high >>> 24) & 0xff;
  b[1] = (high >>> 16) & 0xff;
  b[2] = (high >>> 8) & 0xff;
  b[3] = high & 0xff;
  b[4] = (now >>> 8) & 0xff;
  b[5] = now & 0xff;
  b.set(randomBytes(10), 6);
  b[6] = 0x70 | (b[6] & 0x0f); // version 7
  b[8] = 0x80 | (b[8] & 0x3f); // variant 10
  const h = Array.from(b, (x) => HEX[x]).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** A record id: `prefix` (e.g. `'pile-'`) for readable logs, then a UUIDv7. */
export function newId(prefix = ''): string {
  return `${prefix}${uuidv7()}`;
}
