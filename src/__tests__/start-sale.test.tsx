import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import PickPointScreen from '../app/sale/[id]/points';
import StartSaleScreen from '../app/sale/[id]/start';
import { peopleStore as mockMaster } from '../store/people';
import { SaleProvider } from '../store/SaleProvider';
import { store as mockEventStore } from '../store/store';
import { wrap } from '../test/render';

jest.mock('../store/people', () => {
  const actual = jest.requireActual('../store/master-store');
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { ...actual, peopleStore: new MemoryPeopleStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: mockPush, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({}),
}));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

type Sys = { kind: string; payload?: { t: string } & Record<string, unknown> };
const sys = async (saleId: string, t: string) =>
  ((await mockEventStore.load(saleId)) as Sys[]).filter((e) => e.kind === 'sys' && e.payload?.t === t).map((e) => e.payload!);

describe('E04-S02 — start a sale from master data', () => {
  beforeEach(() => mockPush.mockClear());

  it('the header is pre-filled: latest buyer, the manager, group defaults; next writes it without a price', async () => {
    const buyer = await mockMaster.addBuyer('ล้ง ก');
    jest.spyOn(mockMaster, 'latestBuyerId').mockResolvedValue(buyer.id);
    const boss = await mockMaster.create('อ.สมหวัง', ['manager']);
    wrap(
      <SaleProvider saleId="sale-start-1">
        <StartSaleScreen />
      </SaleProvider>,
    );
    await flush();
    expect(screen.getByTestId('start-buyer')).toHaveTextContent(/ล้ง ก/);
    expect(screen.getByTestId('start-manager')).toHaveTextContent(/อ.สมหวัง/);
    expect(screen.getByTestId('start-numbering-per-tapper').props.accessibilityState).toMatchObject({ selected: true });
    await act(async () => {
      fireEvent.press(screen.getByTestId('start-next'));
    });
    await flush();
    expect(await sys('sale-start-1', 'sale_started')).toMatchObject([{ buyer: 'ล้ง ก', buyerId: buyer.id, manager: 'อ.สมหวัง', managerId: boss.id }]);
    expect(await sys('sale-start-1', 'numbering_set')).toMatchObject([{ numbering: 'per-tapper' }]);
    expect(await sys('sale-start-1', 'price_set')).toEqual([]);
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/sale/[id]/points' }));
    jest.restoreAllMocks();
  });

  it('a price typed at the start is kept; it can also come later', async () => {
    wrap(
      <SaleProvider saleId="sale-start-2">
        <StartSaleScreen />
      </SaleProvider>,
    );
    await flush();
    fireEvent.changeText(screen.getByTestId('start-price'), '52.50');
    await act(async () => {
      fireEvent.press(screen.getByTestId('start-next'));
    });
    await flush();
    expect(await sys('sale-start-2', 'price_set')).toMatchObject([{ satangPerKg: 5250 }]);
  });
});

describe('E04-S02 — pick farm → tapper → point', () => {
  it('lists the farm\'s points under their tappers; picking one adds farm + point to the sale and opens the counter', async () => {
    const f = await mockMaster.addProperty({ name: 'สวนทดสอบ', crop: 'rubber' });
    const red = await mockMaster.create('แดงทดสอบ', ['tapper']);
    const [p1] = await mockMaster.createStarterPoints([{ propertyId: f.id, tapperId: red.id, names: ['จุดทดสอบ'] }]);
    const lone = await mockMaster.addPoint(f.id, 'จุดว่าง');
    wrap(
      <SaleProvider saleId="sale-pick-1">
        <PickPointScreen />
      </SaleProvider>,
    );
    await flush();
    fireEvent.press(screen.getByTestId(`pick-farm-${f.id}`));
    await flush();
    expect(screen.getByTestId(`pick-tapper-${red.id}`)).toBeTruthy();
    expect(screen.getByTestId(`pick-point-${lone.id}`)).toHaveTextContent(/ยังไม่มีคนกรีด/);
    await act(async () => {
      fireEvent.press(screen.getByTestId(`pick-point-${p1.id}`));
    });
    await flush();
    expect(await sys('sale-pick-1', 'zone_added')).toMatchObject([{ zoneId: f.id, name: 'สวนทดสอบ' }]);
    expect(await sys('sale-pick-1', 'pile_added')).toMatchObject([{ pileId: p1.id, zoneId: f.id, tareG: 2_000, stdNetG: 50_000 }]);
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/sale/[id]/counter', params: expect.objectContaining({ pile: p1.id }) }));
  });
});
