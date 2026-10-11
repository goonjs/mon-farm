import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryPeopleStore } from './people-memory';
import { setSessionGroup, setSessionUser } from './session';

/**
 * MemoryPeopleStore only — the platform adapters (people.web.ts,
 * people.native.ts) touch localStorage / expo-sqlite and are exercised via
 * Playwright once a real screen uses them (S6), not here.
 */
describe('MemoryPeopleStore', () => {
  let store: MemoryPeopleStore;
  beforeEach(() => {
    setSessionUser('user-1');
    setSessionGroup('group-1');
    store = new MemoryPeopleStore();
  });

  it('starts empty', async () => {
    expect(await store.list()).toEqual([]);
  });

  it('creates a person with a name, an id, and not deleted', async () => {
    const p = await store.create('ประยุทธ', ['tapper']);
    expect(p.name).toBe('ประยุทธ');
    expect(p.id).toBeTruthy();
    expect(p.deleted).toBe(false);
    expect(await store.get(p.id)).toEqual(p);
  });

  it('lists active people alphabetically', async () => {
    await store.create('สมหญิง', ['tapper']);
    await store.create('ประยุทธ', ['tapper']);
    await store.create('มานพ', ['tapper']);
    const names = (await store.list()).map((p) => p.name);
    // Thai collation order — not insertion order.
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'th')));
    expect(names).toHaveLength(3);
  });

  it('rename changes the name but not the id', async () => {
    const p = await store.create('ประยุทธ', ['tapper']);
    await store.rename(p.id, 'ประยุทธ์');
    const after = await store.get(p.id);
    expect(after?.id).toBe(p.id);
    expect(after?.name).toBe('ประยุทธ์');
  });

  it('remove (soft delete) removes a person from list() but not from get()', async () => {
    const p = await store.create('ประยุทธ', ['tapper']);
    await store.remove(p.id);

    expect(await store.list()).toEqual([]);
    const after = await store.get(p.id);
    expect(after?.deleted).toBe(true);
    expect(after?.name).toBe('ประยุทธ'); // still resolvable — a past settlement can still show the name
  });

  it('rename on an unknown id is a no-op, not an error', async () => {
    await expect(store.rename('nope', 'x')).resolves.toBeUndefined();
  });
});
