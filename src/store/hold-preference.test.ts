import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_HOLD_MS, readHoldMs, writeHoldMs } from './hold-preference';

function stubStorage() {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => m.set(k, v),
  };
}

describe('hold time is a device preference (E03-S07)', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('defaults to 0.7 s with nothing stored, or no storage at all', () => {
    expect(readHoldMs()).toBe(DEFAULT_HOLD_MS);
    stubStorage();
    expect(readHoldMs()).toBe(700);
  });

  it('remembers a value in 0.5–1 s and ignores anything outside it', () => {
    stubStorage();
    writeHoldMs(900);
    expect(readHoldMs()).toBe(900);
    writeHoldMs(1500);
    expect(readHoldMs()).toBe(900);
  });
});
