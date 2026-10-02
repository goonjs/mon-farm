import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LogBuilder } from '../core/fixtures';
import type { AcceptEvent } from '../core/types';
import { IntegrityError } from './errors';
import { WebStore } from './store.web';

/** A minimal in-memory Storage — enough for the adapter, no DOM needed. */
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

describe('WebStore — EventStore rules on the real web adapter (E01-S02)', () => {
  it('treats a repeated event as a no-op and a changed one as an IntegrityError', async () => {
    const store = new WebStore();
    const [e] = new LogBuilder().accept('p1').build() as AcceptEvent[];
    await store.append(e);
    await store.append(Object.fromEntries(Object.entries(e).reverse()) as AcceptEvent);
    await expect(store.append({ ...e, netG: 1 })).rejects.toBeInstanceOf(IntegrityError);
    expect(await store.load(e.saleId)).toEqual([e]);
  });

  it('resumes the device sequence after a restart and refuses a used number', async () => {
    const first = new WebStore();
    const { deviceId } = await first.device();
    const [a, b] = new LogBuilder('s1', deviceId).accept('p1').accept('p1').build();
    await first.append(a);
    await first.append(b);

    // A new instance stands in for the app after a force-close.
    const restarted = new WebStore();
    expect(await restarted.device()).toEqual({ deviceId, nextDeviceSeq: 3 });
    const [reused] = new LogBuilder('s2', deviceId).accept('p1').build();
    await expect(restarted.append(reused)).rejects.toBeInstanceOf(IntegrityError);
  });

  it('removes only the v0.4 sale keys, once', async () => {
    localStorage.setItem('mon-farm:events:old', '[]');
    localStorage.setItem('mon-farm:sales', '["old"]');
    localStorage.setItem('mon-farm:synced', '[]');
    localStorage.setItem('mon-farm:locale', 'en');
    localStorage.setItem('mon-farm:people', '[]');
    localStorage.setItem('mon-farm:farm-profile', '{}');
    localStorage.setItem('mon-farm:speech-on', 'true');

    expect(await new WebStore().listSales()).toEqual([]);
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).sort();
    expect(keys).toEqual([
      'mon-farm-v1:meta',
      'mon-farm:farm-profile',
      'mon-farm:people',
      'mon-farm:speech-on',
    ]);

    // A key reappearing later is not swept again: cleanup ran once.
    localStorage.setItem('mon-farm:locale', 'en');
    await new WebStore().listSales();
    expect(localStorage.getItem('mon-farm:locale')).toBe('en');
  });
});
