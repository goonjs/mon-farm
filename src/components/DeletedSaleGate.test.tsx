import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { DeletedSaleGate } from './DeletedSaleGate';
import { LogBuilder, setUpSale } from '../core/fixtures';
import { SaleProvider } from '../store/SaleProvider';
import { store as mockStore } from '../store/store';
import { wrap } from '../test/render';
import { setSessionUser } from '../store/session';

jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('expo-router', () => ({ Link: ({ children }: { children: ReactNode }) => children }));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

// E02-S01: nothing is recorded without a signed-in user.
beforeAll(() => setSessionUser('user-test'));

describe('DeletedSaleGate — a deleted sale cannot be recorded into (E01-S04)', () => {
  it('shows a restore notice instead of the sale, and the sale again once restored', async () => {
    for (const e of setUpSale(new LogBuilder('sale-x', 'dev-other')).remove('sale-x').build()) {
      await mockStore.append(e);
    }
    wrap(
      <SaleProvider saleId="sale-x">
        <DeletedSaleGate>
          <Text testID="sale-screen">counter</Text>
        </DeletedSaleGate>
      </SaleProvider>,
    );
    await flush();

    expect(screen.queryByTestId('sale-screen')).toBeNull();
    expect(screen.getByTestId('deleted-sale-notice')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('deleted-sale-restore'));
    });
    await flush();

    expect(screen.getByTestId('sale-screen')).toBeTruthy();
    const log = await mockStore.load('sale-x');
    expect(log[log.length - 1]).toMatchObject({ kind: 'restore', targetId: 'sale-x' });
  });
});
