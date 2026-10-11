import { LogBuilder } from '../core/fixtures';
import { NoGroupError } from '../core/scope';
import { financeStore } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import { setDeleted } from '../store/record';
import { NotSignedInError, setSessionGroup, setSessionUser } from '../store/session';
import { store } from '../store/store';

/**
 * E02-S01/S02, option A: the write paths outside the master store (sale log
 * and finance log) get `actor.userId` and `groupId` from the session, in the
 * one function each store writes through. The master store is covered in
 * master-store.test.ts; the farm profile is device configuration, not events.
 */
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
});

const payload = { t: 'reserve_set', amountSatang: 100, assumption: '', source: '' } as const;

describe('sale log: record.ts', () => {
  it('a soft delete names the signed-in user and the open group', async () => {
    const b = new LogBuilder('sale-x');
    for (const e of b.accept('p1').build()) await store.append(e);
    await setDeleted('sale-x', true);
    const added = (await store.load('sale-x')).find((e) => e.kind === 'delete')!;
    expect(added.groupId).toBe('group-1');
    expect(added.actor.userId).toBe('test-user');
  });

  it('with no open group it fails and stores nothing', async () => {
    setSessionGroup(null);
    const before = (await store.load('sale-x')).length;
    await expect(setDeleted('sale-x', false)).rejects.toBeInstanceOf(NoGroupError);
    expect(await store.load('sale-x')).toHaveLength(before);
  });
});

describe('finance log: finance-write.ts', () => {
  it('an event names the signed-in user and the open group', async () => {
    const e = await writeFinance('reserve', null, payload);
    expect(e).toMatchObject({ groupId: 'group-1', actor: { userId: 'test-user' } });
    expect(await financeStore.load()).toContainEqual(e);
  });

  it('with no open group it fails and stores nothing', async () => {
    setSessionGroup(null);
    const before = (await financeStore.load()).length;
    await expect(writeFinance('reserve', null, payload)).rejects.toBeInstanceOf(NoGroupError);
    expect(await financeStore.load()).toHaveLength(before);
  });

  it('with nobody signed in it fails and stores nothing', async () => {
    setSessionUser(null);
    const before = (await financeStore.load()).length;
    await expect(writeFinance('reserve', null, payload)).rejects.toBeInstanceOf(NotSignedInError);
    expect(await financeStore.load()).toHaveLength(before);
  });
});
