import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readEra, writeEra } from './preference';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal('localStorage', fakeStorage());
});

describe('era preference (D-74 F14: remembered on the device)', () => {
  it('has nothing stored at first', async () => {
    expect(await readEra()).toBeNull();
  });

  it('remembers the choice', async () => {
    await writeEra('ce');
    expect(await readEra()).toBe('ce');
  });

  it('ignores junk and never throws', async () => {
    localStorage.setItem('mon-farm:era', 'xx');
    expect(await readEra()).toBeNull();
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    expect(await readEra()).toBeNull();
    expect(() => writeEra('be')).not.toThrow();
  });
});
