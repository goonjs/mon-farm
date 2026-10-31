import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * E01-S19 DS-1 / DS-3 / DS-5 on native, with expo-sqlite's kv-store faked.
 * `files` stands in for the SQLite files on the phone: it outlives a module
 * instance, so `vi.resetModules()` + a fresh import is "close and reopen the app".
 */
const files = new Map<string, Map<string, string>>();
let broken = false;

vi.mock('expo-sqlite/kv-store', () => ({
  SQLiteStorage: class {
    private readonly rows: Map<string, string>;
    constructor(name: string) {
      if (broken) throw new Error('unable to open database file');
      if (!files.has(name)) files.set(name, new Map());
      this.rows = files.get(name)!;
    }
    getItemSync(k: string) {
      if (broken) throw new Error('disk I/O error');
      return this.rows.get(k) ?? null;
    }
    setItemSync(k: string, v: string) {
      if (broken) throw new Error('disk I/O error');
      this.rows.set(k, v);
    }
  },
}));

async function openApp() {
  vi.resetModules();
  return (await import('./device-settings.native')).deviceSettings;
}

describe('device settings on native (E01-S19)', () => {
  beforeEach(() => {
    files.clear();
    broken = false;
  });

  it('remembers a value across a restart (DS-3)', async () => {
    const first = await openApp();
    expect(first.get('mon-farm:count-mode')).toBeNull();
    first.set('mon-farm:count-mode', 'tap');
    first.set('mon-farm:locale', 'en');
    const reopened = await openApp();
    expect(reopened.get('mon-farm:count-mode')).toBe('tap');
    expect(reopened.get('mon-farm:locale')).toBe('en');
  });

  it('keeps its own file, apart from the event log database', async () => {
    (await openApp()).set('mon-farm:era', 'ce');
    expect([...files.keys()]).toEqual(['mon-farm-settings.db']);
  });

  it('gives null and does not throw when the store fails (DS-5)', async () => {
    const s = await openApp();
    broken = true;
    expect(s.get('mon-farm:hold-ms')).toBeNull();
    expect(() => s.set('mon-farm:hold-ms', '800')).not.toThrow();
  });

  it('gives null when the settings file cannot even be opened (DS-5)', async () => {
    broken = true;
    const s = await openApp();
    expect(s.get('mon-farm:locale')).toBeNull();
    expect(() => s.set('mon-farm:locale', 'en')).not.toThrow();
  });

  it('can be read during render — native has no static render (DS-4)', async () => {
    expect((await openApp()).readDuringRender).toBe(true);
  });
});
