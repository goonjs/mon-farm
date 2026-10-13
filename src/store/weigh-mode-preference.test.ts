import { afterEach, describe, expect, it } from 'vitest';

import { readWeighBasis, readWeighMode, writeWeighBasis, writeWeighMode } from './weigh-mode-preference';

function stubStorage() {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => m.set(k, v),
  };
}

describe('how a short basket is recorded is a device preference (E04-S16)', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('defaults to typing, and to the scale reading on the dial, with no storage or nothing stored', () => {
    expect(readWeighMode()).toBe('type');
    expect(readWeighBasis()).toBe('scale');
    stubStorage();
    expect(readWeighMode()).toBe('type');
    expect(readWeighBasis()).toBe('scale');
  });

  it('remembers each choice and ignores anything it does not know', () => {
    stubStorage();
    writeWeighMode('dial');
    writeWeighBasis('net');
    expect(readWeighMode()).toBe('dial');
    expect(readWeighBasis()).toBe('net');
    writeWeighMode('nope' as never);
    writeWeighBasis('nope' as never);
    expect(readWeighMode()).toBe('dial');
    expect(readWeighBasis()).toBe('net');
  });
});
