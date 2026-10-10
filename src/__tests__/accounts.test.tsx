import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import AccountsScreen from '../app/finance/accounts';
import { SaleAccountCard } from '../components/finance/SaleAccountCard';
import { projectAccounts } from '../core/finance/accounts';
import { financeStore as mockFinance } from '../store/finance';
import { wrap } from '../test/render';

jest.mock('../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
});
jest.mock('../store/people', () => {
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { peopleStore: new MemoryPeopleStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});

// Built inside the factory: jest.mock is hoisted above any outer const.
jest.mock('expo-router', () => {
  const params: { current: Record<string, string> } = { current: {} };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => params.current,
    router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false },
    __params: params,
  };
});

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}



describe('receiving accounts (E05-S07)', () => {
  it('needs bank or PromptPay; checks the number; the first account becomes the default', async () => {
    wrap(<AccountsScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('account-add'));
    await act(async () => fireEvent.press(screen.getByTestId('account-save')));
    expect(screen.getByTestId('account-err-bank-or-promptpay')).toBeTruthy();

    fireEvent.press(screen.getByTestId('account-bank-KBANK'));
    fireEvent.changeText(screen.getByTestId('account-number'), '12345');
    await act(async () => fireEvent.press(screen.getByTestId('account-save')));
    expect(screen.getByTestId('account-err-account-number')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('account-number'), '1234567890');
    fireEvent.changeText(screen.getByTestId('account-name'), 'สมชาย');
    fireEvent.press(screen.getByTestId('account-pp-mobile'));
    fireEvent.changeText(screen.getByTestId('account-pp-number'), '0812345678');
    await act(async () => fireEvent.press(screen.getByTestId('account-save')));
    await flush();

    const s = projectAccounts(await mockFinance.load());
    expect(s.accounts).toHaveLength(1);
    expect(s.defaultId).toBe(s.accounts[0].id);
    expect(screen.getByTestId(`account-default-${s.accounts[0].id}`)).toBeTruthy();
  });

  it('deleting the default asks first and leaves no default', async () => {
    wrap(<AccountsScreen />);
    await flush();
    const id = projectAccounts(await mockFinance.load()).accounts[0].id;
    fireEvent.press(screen.getByTestId(`account-delete-${id}`));
    await act(async () => fireEvent.press(screen.getByTestId(`account-delete-confirm-${id}`)));
    await flush();
    expect(projectAccounts(await mockFinance.load()).defaultId).toBeNull();
    await act(async () => fireEvent.press(screen.getByTestId(`account-restore-${id}`)));
    await flush();
  });

  it('a sale records cash instead of the default', async () => {
    wrap(<SaleAccountCard saleId="sale-9" ownerSatang={14936725} />);
    await flush();
    expect(screen.getByTestId('sale-account-amount').props.children).toContain('149,367.25');
    await act(async () => fireEvent.press(screen.getByTestId('sale-account-cash')));
    await flush();
    expect(projectAccounts(await mockFinance.load()).choiceFor('sale-9')).toEqual({ kind: 'cash' });
  });
});
