import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { PaymentStatusCard, type Payee } from '../components/finance/PaymentStatusCard';
import { paymentStatus } from '../core/finance/payments';
import { financeStore as mockFinance } from '../store/finance';
import { wrap } from '../test/render';

jest.mock('../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({}),
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const PAYEES: Payee[] = [
  { id: 'person-daeng', name: 'แดง', satang: 3486000, kind: 'cash' },
  { id: 'person-nat', name: 'นัด', satang: 1782375, kind: 'cash' },
  { id: 'owner', name: 'เจ้าของสวน', satang: 5468375, kind: 'transfer' },
];

describe('payment statuses on settlement (E05-S05)', () => {
  it('each payee is ticked on its own; untick is a new event', async () => {
    wrap(<PaymentStatusCard saleId="s1" payees={PAYEES} />);
    await flush();
    expect(screen.getByTestId('pay-person-daeng').props.children).toBe('แดง ได้รับเงินสดแล้ว');
    expect(screen.getByTestId('pay-owner').props.children).toBe('เจ้าของได้รับเงินโอนแล้ว');
    await act(async () => fireEvent.press(screen.getByTestId('pay-toggle-person-daeng')));
    await flush();
    const ev = await mockFinance.load();
    expect(paymentStatus(ev, 's1', 'person-daeng', 3486000)).toMatchObject({ done: true, amountAtMarkSatang: 3486000 });
    expect(paymentStatus(ev, 's1', 'person-nat', 1782375).done).toBe(false);
    expect(screen.getByTestId('pay-done-person-daeng')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByTestId('pay-toggle-person-daeng')));
    await flush();
    expect(paymentStatus(await mockFinance.load(), 's1', 'person-daeng', 3486000).done).toBe(false);
  });

  it('the amount changed after the tick → "ต้องตรวจใหม่" with old and new, only for that payee', async () => {
    wrap(<PaymentStatusCard saleId="s2" payees={PAYEES} />);
    await flush();
    await act(async () => fireEvent.press(screen.getByTestId('pay-toggle-person-daeng')));
    await act(async () => fireEvent.press(screen.getByTestId('pay-toggle-person-nat')));
    await flush();
    screen.unmount();

    wrap(<PaymentStatusCard saleId="s2" payees={[{ ...PAYEES[0], satang: 3436000 }, PAYEES[1], PAYEES[2]]} />);
    await flush();
    expect(screen.getByTestId('pay-recheck-person-daeng').props.children).toBe('ต้องตรวจใหม่: เดิม 34,860.00 → ใหม่ 34,360.00');
    expect(screen.queryByTestId('pay-recheck-person-nat')).toBeNull();
    await act(async () => fireEvent.press(screen.getByTestId('pay-confirm-person-daeng')));
    await flush();
    expect(screen.queryByTestId('pay-recheck-person-daeng')).toBeNull();
    expect(paymentStatus(await mockFinance.load(), 's2', 'person-daeng', 3436000)).toMatchObject({ done: true, recheck: false });
  });
});
