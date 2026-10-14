import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { LogBuilder } from '../core/fixtures';
import { FARM_FUNDS } from '../core/finance/types';
import { financeStore } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { SettlementScreen, TallyScreen } from '../v2/sale/money-screens';

jest.mock('../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('../store/people', () => {
  const { MasterStore } = jest.requireActual('../store/master-store');
  const { createDeviceClock } = jest.requireActual('../store/device-clock');
  const { store } = jest.requireMock('../store/store');
  return { peopleStore: new MasterStore(store, createDeviceClock(store)) };
});
jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => true), dismissAll: jest.fn(), dismissTo: jest.fn() };
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

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}
const press = async (id: string) => {
  await act(async () => fireEvent.press(screen.getByTestId(id)));
  await flush();
};
const type = async (id: string, text: string) => {
  await act(async () => fireEvent.changeText(screen.getByTestId(id), text));
  await flush();
};
const SALE = 'sale-net';
const inSale = async (ui: ReactElement) => {
  const r = wrap(<SaleProvider saleId={SALE}>{ui}</SaleProvider>);
  await flush();
  return r;
};

let farm: MockFarm;

/** Same sale as the money tests: นัด's share is ฿2,061.25. นัด owes the farm ฿3,000 and the farm owes นัด ฿640 for a fertiliser bill. */
beforeAll(async () => {
  farm = await seedMockFarm(master());
  const b = new LogBuilder(SALE);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
  for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
  b.acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 2).acceptAt(farm.a[0], 3);
  b.acceptAt(farm.a[3], 1).shortAt(farm.a[3], 2, 37_000);
  await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
  const NAT = { id: farm.nat, name: 'นัด' };
  await writeFinance('debt-nat', null, {
    t: 'debt_added',
    fields: { worker: NAT, kind: 'loan', amountSatang: 300_000, date: '2026-09-01', note: '', lender: { id: FARM_FUNDS, name: 'เงินสวน' }, fertilizer: null, carriedForward: false },
  });
  await writeFinance('exp-nat', null, {
    t: 'expense_created',
    fields: { amountSatang: 64_000, date: '2026-09-28', stage: 'actual', categoryId: null, propertyId: null, item: '', note: '', payer: NAT },
  });
});

const events = async (t: string) => (await financeStore.load()).filter((e) => e.payload.t === t);

describe('netting against money the farm owes back (E06-S04, D-60, D-67)', () => {
  it('is offered only to a worker the farm owes, and is never applied by itself', async () => {
    await inSale(<SettlementScreen />);
    await press(`deduct-${farm.nat}`);
    expect(screen.getByTestId('net-card')).toHaveTextContent(/640\.00/);
    // opening the sheet and cancelling writes nothing
    await press('deduct-cancel');
    expect(await events('repayment_recorded')).toHaveLength(0);
    expect(await events('debt_payment_recorded')).toHaveLength(0);
  });

  it('netting more than is owed is refused', async () => {
    await inSale(<SettlementScreen />);
    await press(`deduct-${farm.nat}`);
    await type('net-amount', '640.01');
    expect(screen.getByTestId('deduct-save')).toBeDisabled();
    await type('net-amount', '640');
    expect(screen.getByTestId('deduct-save')).toBeEnabled();
  });

  it('part of what the farm owes can be netted; the ceiling grows and the cash stays non-negative', async () => {
    await inSale(<SettlementScreen />);
    await press(`deduct-${farm.nat}`);
    await type('net-amount', '400');
    // หักหนี้ is the whole debt taken: the ceiling is share + netting (2,061.25 + 400) while the debt is large
    await type('deduct-amount', '2461.26');
    expect(screen.getByTestId('deduct-save')).toBeDisabled();
    await type('deduct-amount', '2461.25');
    await press('deduct-save');
    const rep = await events('repayment_recorded');
    expect(rep).toHaveLength(1);
    expect(rep[0].payload.t === 'repayment_recorded' && rep[0].payload.fields.amountSatang).toBe(40_000);
    expect(rep[0].payload.t === 'repayment_recorded' && rep[0].payload.fields.saleId).toBe(SALE);
    const pays = (await events('debt_payment_recorded')).map((e) => (e.payload.t === 'debt_payment_recorded' ? e.payload.fields : null));
    expect(pays.map((p) => p?.method).sort()).toEqual(['cash-from-share', 'netting']);
    expect(pays.find((p) => p?.method === 'netting')?.amountSatang).toBe(40_000);
    expect(pays.find((p) => p?.method === 'netting')?.repaymentId).toBe(rep[0].targetId);
    // share fully taken: cash 0, nothing flagged over-deducted
    expect(screen.getByTestId(`cash-${farm.nat}`)).toHaveTextContent(/^0|\b0\b/);
    expect(screen.getByTestId(`netted-${farm.nat}`)).toHaveTextContent(/400\.00/);
    expect(screen.queryByText(/หักเกินส่วนแบ่ง/)).toBeNull();
  });

  it('every pile still adds up to the sale', async () => {
    await inSale(<TallyScreen />);
    expect(screen.getByTestId('tally-ok')).toBeTruthy();
    expect(screen.getByTestId('tally-sum')).toHaveTextContent(/11,397\.50/);
  });

  it('taking the netting out of the deduction voids both its debt payment and the repayment', async () => {
    await inSale(<SettlementScreen />);
    await press(`edit-deduct-${farm.nat}`);
    await type('net-amount', '0');
    await type('deduct-amount', '0');
    await press('deduct-save');
    const changed = (await financeStore.load()).filter((e) => e.payload.t === 'debt_payment_changed' || e.payload.t === 'repayment_changed');
    expect(changed.map((e) => e.payload.t).sort()).toEqual(['debt_payment_changed', 'debt_payment_changed', 'repayment_changed']);
    expect(screen.queryByTestId(`netted-${farm.nat}`)).toBeNull();
  });
});

describe('tally origin lines with a deduction, a netting and a rounding (E05-S08)', () => {
  const SALE2 = 'sale-net-2';
  beforeAll(async () => {
    const b = new LogBuilder(SALE2);
    b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
    b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
    for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
    b.acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 2).acceptAt(farm.a[0], 3);
    b.acceptAt(farm.a[3], 1).shortAt(farm.a[3], 2, 37_000);
    await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
  });
  const inSale2 = async (ui: ReactElement) => {
    const r = wrap(<SaleProvider saleId={SALE2}>{ui}</SaleProvider>);
    await flush();
    return r;
  };
  /** The amounts after the first "ส่วนแบ่ง", as numbers: share, then each signed part. */
  const parts = (line: string) => {
    const m = [...line.matchAll(/([+−]?)\s*(?:ส่วนแบ่ง|หักหนี้|สวนคืน \(หักกลบ\)|ปัดเศษ)\s*([\d,]+\.\d\d)/g)];
    return m.map((x) => (x[1] === '−' ? -1 : 1) * Math.round(parseFloat(x[2].replace(/,/g, '')) * 100));
  };

  it('the origin line reads as page 17 does (−หักหนี้ +สวนคืน), and its parts add up to the cash above it', async () => {
    const r = await inSale2(<SettlementScreen />);
    await press(`deduct-${farm.nat}`);
    await type('net-amount', '200');
    // 500 of debt: 200 netted, 300 out of the cash
    await type('deduct-amount', '500');
    await press('deduct-save');
    await press('to-rounding');
    await press('round-worker');
    await press('round-confirm');
    r.unmount();
    await inSale2(<TallyScreen />);
    const line = screen.getByTestId(`tally-from-${farm.nat}`).props.children as string;
    // share 2,061.25 − 500 debt + 200 the farm repaid by netting = 1,761.25, rounded up to 1,762.00.
    expect(line).toBe('ส่วนแบ่ง 2,061.25 − หักหนี้ 500.00 + สวนคืน (หักกลบ) 200.00 + ปัดเศษ 0.75');
    expect(parts(line).reduce((a, x) => a + x, 0)).toBe(176_200);
    expect(screen.getByTestId(`tally-cash-${farm.nat}`)).toHaveTextContent(/1,762\.00$/);
    expect(screen.getByTestId(`tally-net-${farm.nat}`)).toHaveTextContent('หักกลบไม่มีเงินสดเคลื่อน: หนี้ลด 200.00 = สวนคืนนัด 200.00');
    expect(screen.getByTestId('tally-ok')).toBeTruthy();
  });
});
