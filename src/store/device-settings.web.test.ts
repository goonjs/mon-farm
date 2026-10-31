import { afterEach, describe, expect, it, vi } from 'vitest';

import { deviceSettings } from './device-settings.web';

/** E01-S19 DS-2 / DS-5: on web the device settings stay in localStorage, under the keys already there. */
function fakeStorage(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    m,
  };
}

describe('device settings on web (E01-S19)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads a value saved before the update, under the same key (DS-2)', () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'mon-farm:text-size': 'l', 'mon-farm:locale': 'en' }));
    expect(deviceSettings.get('mon-farm:text-size')).toBe('l');
    expect(deviceSettings.get('mon-farm:locale')).toBe('en');
  });

  it('writes straight to localStorage with the key unchanged', () => {
    const s = fakeStorage();
    vi.stubGlobal('localStorage', s);
    deviceSettings.set('mon-farm:hold-ms', '900');
    expect(s.m.get('mon-farm:hold-ms')).toBe('900');
    expect(deviceSettings.get('mon-farm:hold-ms')).toBe('900');
  });

  it('gives null and does not throw when storage is missing or broken (DS-5)', () => {
    expect(deviceSettings.get('mon-farm:era')).toBeNull();
    expect(() => deviceSettings.set('mon-farm:era', 'ce')).not.toThrow();
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(deviceSettings.get('mon-farm:era')).toBeNull();
    expect(() => deviceSettings.set('mon-farm:era', 'ce')).not.toThrow();
  });

  it('is not read during render on web, which static-renders (DS-4)', () => {
    expect(deviceSettings.readDuringRender).toBe(false);
  });
});
