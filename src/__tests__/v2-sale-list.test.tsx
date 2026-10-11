import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { LogBuilder } from '../core/fixtures';
import type { MasterStore } from '../store/master-store';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { SalesScreen } from '../v2/sale/sales-screen';

jest.mock('../store/people', () => {
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { peopleStore: new MemoryPeopleStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => ({}),
    useRouter: () => router,
    router,
  };
});

const master = () => (jest.requireMock('../store/people') as { peopleStore: MasterStore }).peopleStore;
const store = () => (jest.requireMock('../store/store') as { store: EventStore }).store;
const router = () => (jest.requireMock('expo-router') as { router: Record<'push', jest.Mock> }).router;

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const at = (b: LogBuilder, ts: number) => b.build().map((e) => ({ ...e, ts }));

describe('v2 sales list (sale mockup page 4)', () => {
  it('lists sales newest first with each tapper\'s kg and the state; tapping opens the sale', async () => {
    const f = await seedMockFarm(master());
    const open = new LogBuilder('sale-new');
    open.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', buyerId: f.buyer, manager: '', workerLead: '', where: 'farm' });
    open.acceptAt(f.a[0], 1).acceptAt(f.a[0], 2).acceptAt(f.a[3], 1);
    const closed = new LogBuilder('sale-old');
    closed.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ข', manager: '', workerLead: '', where: 'farm' });
    closed.acceptAt(f.a[3], 1);
    closed.sys({ t: 'price_set', satangPerKg: 5000, indexRef: '' });
    closed.sys({ t: 'sale_status_set', status: 'completed' });
    await seedSale(store(), at(open, Date.UTC(2026, 8, 18, 3)));
    await seedSale(store(), at(closed, Date.UTC(2026, 8, 4, 3)));

    wrap(<SalesScreen />);
    await flush();

    expect(screen.getByTestId('screen-title').props.children).toBe('การขายทั้งหมด');
    expect(screen.getByText('ใหม่สุดก่อน · แตะเพื่อดูสรุปการขาย')).toBeTruthy();
    expect(screen.getByText('18 ก.ย. 2569')).toBeTruthy();
    expect(screen.getByTestId('sale-kg-sale-new').props.children).toBe('150 กก.');
    expect(screen.getByTestId('sale-status-sale-new').props.accessibilityLabel).toBe('กำลังชั่ง');
    expect(screen.getByTestId('sale-status-sale-old').props.accessibilityLabel).toBe('ปิดแล้ว');
    expect(screen.getByTestId(`sale-tapper-sale-new-${f.red}`)).toHaveTextContent('แดง100 กก.');
    expect(screen.getByTestId(`sale-tapper-sale-new-${f.nat}`)).toHaveTextContent('นัด50 กก.');

    fireEvent.press(screen.getByTestId('sale-row-sale-new'));
    expect(router().push).toHaveBeenLastCalledWith(`/v2/sale/sale-new/counter?point=${f.a[3]}`);
    fireEvent.press(screen.getByTestId('sale-row-sale-old'));
    expect(router().push).toHaveBeenLastCalledWith('/v2/sale/sale-old/payment');
  });

  it('tapping a date switches the era', async () => {
    const open = new LogBuilder('sale-1');
    open.sys({ t: 'sale_started', farmName: '', buyer: 'x', manager: '', workerLead: '', where: 'farm' });
    await seedSale(store(), at(open, Date.UTC(2026, 6, 1, 3)));
    wrap(<SalesScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('sale-date-sale-1'));
    expect(screen.getByText('1 ก.ค. 2026')).toBeTruthy();
  });
});
