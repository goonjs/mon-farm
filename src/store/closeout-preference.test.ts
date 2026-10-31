import { describe, expect, it } from 'vitest';

import { lastRepay, lastRounding, rememberCloseout, repayKey, roundingKey, type PreferenceStore } from './closeout-preference';

const fake = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  const store: PreferenceStore = { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
  return { store, m };
};
const broken: PreferenceStore = {
  get: () => {
    throw new Error('no storage');
  },
  set: () => {
    throw new Error('no storage');
  },
};

describe('closeout preference (CO-23)', () => {
  it('first time: the first item of each menu (โอนรวม / ให้คนกรีด)', () => {
    const { store } = fake();
    expect(lastRepay(store, 'g1', 'w1')).toBe('transfer-with-owner');
    expect(lastRounding(store, 'g1')).toBe('worker');
  });

  it('unknown values and a throwing store fall back to the first item', () => {
    const { store } = fake({ [repayKey('g1', 'w1')]: 'netting', [roundingKey('g1')]: 'half' });
    expect(lastRepay(store, 'g1', 'w1')).toBe('transfer-with-owner');
    expect(lastRounding(store, 'g1')).toBe('worker');
    expect(lastRepay(broken, 'g1', 'w1')).toBe('transfer-with-owner');
    expect(lastRounding(broken, 'g1')).toBe('worker');
  });

  it('keys are per group and per worker', () => {
    const { store, m } = fake();
    rememberCloseout(store, 'g1', [{ workerId: 'w1', route: 'cash-from-share' }], 'owner');
    expect(m.get('mon-farm:last-repay:g1:w1')).toBe('cash-from-share');
    expect(m.get('mon-farm:last-rounding:g1')).toBe('owner');
    expect(lastRepay(store, 'g1', 'w1')).toBe('cash-from-share');
    expect(lastRepay(store, 'g1', 'w2')).toBe('transfer-with-owner');
    expect(lastRepay(store, 'g2', 'w1')).toBe('transfer-with-owner');
    expect(lastRounding(store, 'g2')).toBe('worker');
  });

  it('no rounding remembered when the sale had no fraction; a throwing store does not throw', () => {
    const { store, m } = fake();
    rememberCloseout(store, 'g1', [], null);
    expect(m.size).toBe(0);
    expect(() => rememberCloseout(broken, 'g1', [{ workerId: 'w1', route: 'buyer-split' }], 'none')).not.toThrow();
  });
});

describe('the real store is the device-settings module (E01-S19)', () => {
  it('reads and writes through deviceSettings, never localStorage', async () => {
    const { deviceSettings } = await import('./device-settings');
    const { localPreferenceStore } = await import('./closeout-preference');
    expect(localPreferenceStore).toBe(deviceSettings);
  });
});
