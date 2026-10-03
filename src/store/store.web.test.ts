import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LogBuilder } from '../core/fixtures';
import { durabilityLost } from './durability';
import { IntegrityError } from './errors';
import { MemoryStore } from './memory-store';
import { cleanUpLegacy, WebStore } from './store.web';

/** A minimal in-memory Storage — enough for the cleanup, no DOM needed. */
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

describe('legacy cleanup (E01-S02/S03 AC: no migration)', () => {
  it('removes only the old sale-log keys and the interim v1 localStorage keys', () => {
    for (const k of [
      'mon-farm:events:old',
      'mon-farm:sales',
      'mon-farm:synced',
      'mon-farm:locale',
      'mon-farm-v1:events:s1',
      'mon-farm-v1:meta',
      'mon-farm:people',
      'mon-farm:farm-profile',
      'mon-farm:speech-on',
    ]) {
      localStorage.setItem(k, '1');
    }
    cleanUpLegacy();
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).sort();
    expect(keys).toEqual(['mon-farm:farm-profile', 'mon-farm:people', 'mon-farm:speech-on']);
  });

  it('never throws, even when storage itself does', () => {
    const broken = { get length(): number { throw new Error('denied'); } } as unknown as Storage;
    expect(() => cleanUpLegacy(broken)).not.toThrow();
  });

  it('never throws when merely reading localStorage throws (blocked storage)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    expect(() => cleanUpLegacy()).not.toThrow();
  });
});

describe('WebStore without IndexedDB (E01-S03 AC4)', () => {
  it('falls back to memory when even reading indexedDB throws (sandboxed frame)', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    const store = new WebStore();
    expect(await store.isDurable()).toBe(false);
    await expect(store.listSales()).resolves.toEqual([]);
  });

  it('raises the not-durable signal when storage fails after opening — not on a refused append', async () => {
    const failing = new MemoryStore();
    let failWith: Error | null = new IntegrityError('refused.');
    failing.append = async () => {
      throw failWith;
    };
    const store = new WebStore(async () => failing);
    const [e] = new LogBuilder().accept('p1').build();

    await expect(store.append(e)).rejects.toBeInstanceOf(IntegrityError);
    expect(durabilityLost()).toBe(false);

    failWith = new Error('QuotaExceededError');
    await expect(store.append(e)).rejects.toThrow('Quota');
    expect(durabilityLost()).toBe(true);
  });

  it('still records, in memory, and reports that it is not durable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const store = new WebStore();
    const { deviceId } = await store.device();
    const [e] = new LogBuilder('s1', deviceId).accept('p1').build();
    await store.append(e);
    expect(await store.load('s1')).toEqual([e]);
    expect(await store.isDurable()).toBe(false);
  });
});
