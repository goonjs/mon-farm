import { beforeEach, describe, expect, it, vi } from 'vitest';

import { userFromSignIn } from '../core/user';
import { MemoryAccountStore } from './account-memory';
import { WebAccountStore } from './account.web';
import { durabilityLost } from './durability';

/** A minimal in-memory Storage, shared between store instances to model a reload. */
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

const somchai = userFromSignIn('uid-1', 'สมชาย', { provider: 'google', subject: 'g-1' });

describe('MemoryAccountStore', () => {
  it('has no user until one signs in', async () => {
    const s = new MemoryAccountStore();
    expect(await s.user()).toBeNull();
    await s.saveUser(somchai);
    expect(await s.user()).toEqual(somchai);
  });
});

describe('WebAccountStore (E02-S01: the session survives a force-close)', () => {
  let storage: Storage;
  beforeEach(() => {
    storage = fakeStorage();
  });

  it('a signed-in user is still there after a reload, with no network involved', async () => {
    await new WebAccountStore(() => storage).saveUser(somchai);
    const afterReload = new WebAccountStore(() => storage);
    expect(await afterReload.user()).toEqual(somchai);
  });

  it('a fresh profile has no user', async () => {
    expect(await new WebAccountStore(() => storage).user()).toBeNull();
  });

  it('unreadable stored data reads as signed out rather than crashing', async () => {
    storage.setItem('mon-farm:account', '{not json');
    expect(await new WebAccountStore(() => storage).user()).toBeNull();
  });

  it('a storage failure keeps the user for this session and raises the not-durable warning', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken = { ...fakeStorage(), setItem: () => { throw new Error('quota'); } } as Storage;
    const s = new WebAccountStore(() => broken);
    await s.saveUser(somchai);
    expect(await s.user()).toEqual(somchai);
    expect(durabilityLost()).toBe(true);
  });
});
