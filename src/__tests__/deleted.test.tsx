import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import DeletedSalesScreen from '../app/deleted';
import { LogBuilder, setUpSale } from '../core/fixtures';
import { projectSale } from '../core/project';
import { store as mockStore } from '../store/store';
import { wrap } from '../test/render';
import { setSessionGroup, setSessionUser } from '../store/session';

// The real MemoryStore — it has its own unsuffixed file since E01-S03, so
// Jest's platform resolution no longer gets in the way.
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
}));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function seed(saleId: string, deleted: boolean) {
  const b = setUpSale(new LogBuilder(saleId, 'dev-other'));
  if (deleted) b.remove(saleId);
  for (const e of b.build()) await mockStore.append(e);
}

// E02-S01/S02: nothing is recorded without a signed-in user in an open group.
beforeAll(() => {
  setSessionUser('user-test');
  setSessionGroup('group-test');
});

describe('DeletedSalesScreen — E01-S04 (SYNC-10)', () => {
  it('lists only deleted sales, and restoring one writes a restore event and removes it from the list', async () => {
    await seed('sale-gone', true);
    await seed('sale-kept', false);

    wrap(<DeletedSalesScreen />);
    await flush();

    expect(screen.getByTestId('deleted-sale-gone')).toBeTruthy();
    expect(screen.queryByTestId('deleted-sale-kept')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByTestId('restore-sale-gone'));
    });
    await flush();

    const log = await mockStore.load('sale-gone');
    expect(log[log.length - 1]).toMatchObject({ kind: 'restore', targetId: 'sale-gone', source: 'app' });
    expect(projectSale(log, 'sale-gone').deleted).toBe(false);
    expect(screen.queryByTestId('deleted-sale-gone')).toBeNull();
    expect(screen.getByTestId('deleted-empty')).toBeTruthy();
  });
});
