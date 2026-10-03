import { afterEach, describe, expect, it, vi } from 'vitest';

import { newId, uuidv7 } from './id';

const UUIDV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('uuidv7 — E01-S02 AC1, RFC 9562', () => {
  it('is a lowercase canonical 36-character UUIDv7', () => {
    expect(uuidv7()).toMatch(UUIDV7);
  });

  it('carries the millisecond timestamp in its first 48 bits', () => {
    const now = 0x0190_1234_5678;
    const hex = uuidv7(now).replace(/-/g, '').slice(0, 12);
    expect(parseInt(hex, 16)).toBe(now);
  });

  it('does not repeat across many ids minted in the same millisecond', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) ids.add(uuidv7(1_770_000_000_000));
    expect(ids.size).toBe(10_000);
  });

  it('never falls back to Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    uuidv7();
    newId('zone-');
    expect(spy).not.toHaveBeenCalled();
  });

  it('throws when no CSPRNG is available rather than degrading', () => {
    vi.stubGlobal('crypto', undefined);
    expect(() => uuidv7()).toThrow(/CSPRNG/);
  });
});

describe('newId', () => {
  it('is a prefixed UUIDv7, so record ids are globally unique too', () => {
    const id = newId('pile-');
    expect(id.startsWith('pile-')).toBe(true);
    expect(id.slice('pile-'.length)).toMatch(UUIDV7);
  });
});
