import { workedExampleLog } from '../core/fixtures';
import { DeleteBlockedError, setDeleted } from '../store/record';
import { store as mockStore } from '../store/store';
import { setSessionUser } from '../store/session';

jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});

// E02-S01: nothing is recorded without a signed-in user.
beforeAll(() => setSessionUser('user-test'));

describe('setDeleted — the write path enforces D-44 (E01-S16)', () => {
  it('refuses to delete a zone whose worker has live deductions, and writes nothing', async () => {
    const b = workedExampleLog('sale-guard');
    b.deduction('person-manop', 10_000, 'advance', 'สมชาย', 'มานพ');
    for (const e of b.build()) await mockStore.append(e);
    const before = (await mockStore.load('sale-guard')).length;

    await expect(setDeleted('sale-guard', true, 'zB')).rejects.toBeInstanceOf(DeleteBlockedError);
    expect(await mockStore.load('sale-guard')).toHaveLength(before);

    // The other zone is free to go.
    await setDeleted('sale-guard', true, 'zA');
    const log = await mockStore.load('sale-guard');
    expect(log[log.length - 1]).toMatchObject({ kind: 'delete', targetId: 'zA' });
  });
});
