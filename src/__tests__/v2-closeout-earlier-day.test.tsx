import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { LogBuilder } from '../core/fixtures';
import { financeStore } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { CloseoutCashScreen } from '../v2/sale/closeout/cash-screen';
import { CloseoutPayScreen } from '../v2/sale/closeout/pay-screen';
import { CloseoutSummaryScreen } from '../v2/sale/closeout/summary-screen';
import { clearDraft, updateDraft } from '../v2/sale/closeout/use-closeout';

/**
 * E05-S10 (owner 2026-10-27) on the E05-S11 pages: a sale entered for an
 * earlier day deducts part of a debt dated later — what it leaves is still
 * owed, not 0; the cash repayment reads plainly; and the farm ticks that it
 * got the cash. And D-69: only debts owed to the farm are deducted at a sale.
 */

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
const { router } = jest.requireMock('expo-router') as { router: Record<'push' | 'replace' | 'back' | 'dismissTo', jest.Mock> };

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}
const last = (id: string) => screen.getAllByTestId(id).pop()!;
const press = async (id: string) => {
  await act(async () => fireEvent.press(last(id)));
  await flush();
};
const keys = async (digits: string) => {
  for (const d of digits) await press(`co-pad-key-${d}`);
};
/** Clear the pad, then type. */
const retype = async (digits: string) => {
  for (let i = 0; i < 10; i++) await press('co-pad-key-back');
  await keys(digits);
};

let farm: MockFarm;
const DAY = '2026-10-13';

/** A sale entered for 13 Oct at 48.50: แดง 150 kg (share 3,637.50), นัด 85 kg (share 2,061.25). */
async function earlySale(id: string) {
  const b = new LogBuilder(id);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
  for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
  b.acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 2).acceptAt(farm.a[0], 3);
  b.acceptAt(farm.a[3], 1).shortAt(farm.a[3], 2, 37_000);
  await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.parse(`${DAY}T08:00:00`) })));
}

const inSale = async (saleId: string, ui: ReactElement) => {
  const r = wrap(<SaleProvider saleId={saleId}>{ui}</SaleProvider>);
  await flush();
  return r;
};
const all = () => financeStore.load();
const live = async (saleId: string, worker: string) => {
  const es = await all();
  const gone = new Set(es.filter((e) => e.payload.t === 'debt_payment_changed' && e.payload.patch.deleted).map((e) => e.targetId));
  return es.flatMap((e) =>
    e.payload.t === 'debt_payment_recorded' && e.payload.fields.saleId === saleId && e.payload.fields.worker.id === worker && !gone.has(e.targetId) ? [[e.payload.fields.method, e.payload.fields.amountSatang, e.payload.fields.date] as const] : [],
  );
};
async function gates(saleId: string) {
  await press('co-debt-open');
  await press('co-debt-ok');
  await press('co-owed-none');
}

const S1 = 'early-1';
const S2 = 'early-2';

/** นัด's fertilizer debt of 1,500 is dated 27 Oct; แดง owes 5,000 to someone else, not to the farm. */
beforeAll(async () => {
  farm = await seedMockFarm(master());
  await earlySale(S1);
  await earlySale(S2);
  const RED = { id: farm.red, name: 'แดง' };
  const NAT = { id: farm.nat, name: 'นัด' };
  await writeFinance('debt-red-other', null, { t: 'debt_added', fields: { worker: RED, kind: 'loan', amountSatang: 500_000, date: '2026-09-01', note: '', lender: { id: 'p-somwang', name: 'สมหวัง' }, fertilizer: null, carriedForward: false } });
  await writeFinance('debt-nat', null, { t: 'debt_added', fields: { worker: NAT, kind: 'fertilizer', amountSatang: 150_000, date: '2026-10-27', note: '', lender: null, fertilizer: { totalSatang: 300_000, workerPct: 50 }, carriedForward: false } });
});

beforeEach(() => {
  globalThis.localStorage?.clear();
  router.push.mockClear();
});

describe('D-69 · only debts owed to the farm are deducted at a sale', () => {
  it('แดง\'s loan from someone else is not on the debt card and has no deduction row', async () => {
    await inSale(S1, <CloseoutSummaryScreen />);
    expect(last('co-debt-badge')).toHaveTextContent('1');
    expect(last('co-debt-card')).toHaveTextContent(/นัด/);
    expect(last('co-debt-card')).not.toHaveTextContent(/แดง/);
    expect(screen.queryByTestId(`co-deduct-${farm.red}`)).toBeNull();
    expect(last(`co-cash-${farm.red}`)).toHaveTextContent('3,638.00');
  });
});

describe('E05-S10 · a sale for an earlier day, part of a later-dated debt taken as separate cash', () => {
  beforeEach(() => clearDraft(S1));

  it('AC1: the debt left after this sale is what the sale did not take, not 0', async () => {
    await inSale(S1, <CloseoutSummaryScreen />);
    expect(last(`co-deduct-${farm.nat}`)).toHaveTextContent(/−1,500\.00/);
    await press(`co-deduct-${farm.nat}`);
    await retype('1000');
    expect(last('co-res-left')).toHaveTextContent(/500\.00$/);
    await press('co-deduct-ok');
    expect(last(`co-cash-${farm.nat}`)).toHaveTextContent('1,062.00');
  });

  it('AC2: the separate cash repayment reads plainly on the cash step; confirm writes it on the sale day', async () => {
    await act(async () => updateDraft(S1, (d) => ({ ...d, workers: { [farm.nat]: { totalSatang: 100_000 } } })));
    const c = await inSale(S1, <CloseoutCashScreen />);
    await press(`cop-route-${farm.nat}-buyer-split`);
    expect(last(`cop-split-${farm.nat}`)).toHaveTextContent(/↘ เงินสดคืนหนี้นัด \(ให้สวน\)\s*1,000\.00/);
    expect(last('cop-total')).toHaveTextContent(/11,397\.50/);
    await press('cop-ok');
    c.unmount();
    const r = await inSale(S1, <CloseoutSummaryScreen />);
    await gates(S1);
    await press('co-confirm');
    r.unmount();
    expect(await live(S1, farm.nat)).toEqual([['buyer-split', 100_000, DAY]]);
    // the page reopens on what was taken: 500 still owed
    await inSale(S1, <CloseoutSummaryScreen />);
    await press('co-debt-open');
    expect(last(`co-debt-row-${farm.nat}`)).toHaveTextContent(/คงเหลืออีก 500\.00/);
  });

  it('AC3: the payment page has a tick for the cash repayment, and it can be ticked and unticked', async () => {
    await inSale(S1, <CloseoutPayScreen />);
    const id = `tick-debt-cash-${farm.nat}`;
    expect(last(id)).toHaveTextContent(/รับเงินสดคืนหนี้แล้ว · นัด/);
    expect(last(id)).toHaveTextContent(/คนซื้อแยกเงินสด/);
    expect(last(`tick-amt-debt-cash-${farm.nat}`)).toHaveTextContent('1,000.00');
    expect(last(id).props.accessibilityState).toMatchObject({ checked: false, disabled: false });
    await press(id);
    expect(last(id).props.accessibilityState).toMatchObject({ checked: true });
    await press(id);
    expect(last(id).props.accessibilityState).toMatchObject({ checked: false });
  });

  it('AC3: no cash tick for a repayment that comes with the owner\'s transfer', async () => {
    const r = await inSale(S2, <CloseoutSummaryScreen />);
    // what the first sale left: 500, all of it, by the first route (โอนรวม)
    expect(last(`co-deduct-${farm.nat}`)).toHaveTextContent(/−500\.00/);
    await gates(S2);
    await press('co-confirm');
    r.unmount();
    expect(await live(S2, farm.nat)).toEqual([['transfer-with-owner', 50_000, DAY]]);
    await inSale(S2, <CloseoutPayScreen />);
    expect(screen.queryByTestId(`tick-debt-cash-${farm.nat}`)).toBeNull();
    expect(last('pay-sub-owner-repay')).toHaveTextContent(/คืนหนี้/);
  });
});
