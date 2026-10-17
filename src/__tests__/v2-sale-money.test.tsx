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
import { CheckScreen, PaymentScreen, SettlementScreen, TallyScreen } from '../v2/sale/money-screens';
import { clearClosing, markClosing } from '../v2/sale/pieces';
import { PointScreen } from '../v2/sale/point-screen';

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
const { router } = jest.requireMock('expo-router') as { router: Record<'push' | 'replace' | 'dismissAll' | 'dismissTo', jest.Mock> };
/** Two taps in the same tick: a write must land once (review #4). */
const doubleTap = async (id: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(id));
    fireEvent.press(screen.getByTestId(id));
  });
  await flush();
};

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
const SALE = 'sale-money';
const inSale = async (ui: ReactElement) => {
  const r = wrap(<SaleProvider saleId={SALE}>{ui}</SaleProvider>);
  await flush();
  return r;
};

let farm: MockFarm;

/** แดง 3 full at จุด 1 (150 kg); นัด 1 full + 35 kg short at จุด 4 (85 kg); 48.50 ฿/kg. */
beforeAll(async () => {
  farm = await seedMockFarm(master());
  const b = new LogBuilder(SALE);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
  for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
  b.acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 2).acceptAt(farm.a[0], 3);
  b.acceptAt(farm.a[3], 1).shortAt(farm.a[3], 2, 37_000);
  await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
  await writeFinance('debt-nat', null, {
    t: 'debt_added',
    fields: { worker: { id: farm.nat, name: 'นัด' }, kind: 'loan', amountSatang: 150_000, date: '2026-09-01', note: '', lender: { id: FARM_FUNDS, name: 'เงินสวน' }, fertilizer: null, carriedForward: false },
  });
});

describe('v2 sale money (pages 16–19)', () => {
  it('check: our figures, one tap "ตรงกันทั้งหมด" records it', async () => {
    await inSale(<CheckScreen />);
    expect(screen.getByTestId('check-weight')).toHaveTextContent(/235 กก\./);
    expect(screen.getByTestId('check-baskets')).toHaveTextContent(/5 เข่ง/);
    expect(screen.getByTestId('check-total')).toHaveTextContent(/11,397\.50/);
    expect(screen.getByTestId(`check-tapper-${farm.red}`)).toHaveTextContent(/150 กก\./);
    // E05-S09: unit in the label line, dots + short count per tapper, whose short basket it is.
    expect(screen.getByTestId('check-total')).not.toHaveTextContent('บาท');
    expect(screen.getAllByTestId(new RegExp(`^check-dot-${farm.nat}-`))).toHaveLength(2);
    expect(screen.getAllByTestId(new RegExp(`^check-dot-${farm.nat}-.*short$`))).toHaveLength(1);
    expect(screen.getAllByTestId(new RegExp(`^check-dot-${farm.red}-`))).toHaveLength(3);
    expect(screen.getByTestId(`check-tapper-${farm.nat}`)).toHaveTextContent(/เข่งไม่เต็ม 1/);
    expect(screen.getByTestId('check-card')).toHaveTextContent(/เข่ง 2 · นัด/);
    await doubleTap('check-match');
    expect(screen.getByTestId('check-status').props.accessibilityLabel).toBe('ยอดผู้ขายและคนรับซื้อยางตรงกัน');
    const fin = await financeStore.load();
    expect(fin.filter((e) => e.payload.t === 'buyer_check_set')).toHaveLength(1);
  });

  it('settlement: shares per tapper; a debt deducted with the owner\'s transfer moves the transfer', async () => {
    await inSale(<SettlementScreen />);
    expect(screen.getByTestId(`share-amt-${farm.red}`)).toHaveTextContent(/3,637\.50/);
    expect(screen.getByTestId(`share-amt-${farm.nat}`)).toHaveTextContent(/2,061\.25/);
    expect(screen.getByTestId('owner-transfer')).toHaveTextContent(/5,698\.75/);
    // E05-S09: same top card as page 16; money in from the farm is +, money out is −.
    expect(screen.getByTestId('settle-weight')).toHaveTextContent(/235 กก\./);
    expect(screen.getByTestId('settle-total')).toHaveTextContent(/11,397\.50/);
    expect(screen.getByTestId(`pm-${farm.red}-share`)).toHaveTextContent(/\+3,637\.50$/);
    expect(screen.queryByTestId(`deduct-${farm.red}`)).toBeNull();
    await press(`deduct-${farm.nat}`);
    expect(screen.getByTestId('deduct-sheet')).toBeTruthy();
    await press('method-transfer-with-owner');
    await doubleTap('deduct-save');
    expect((await financeStore.load()).filter((e) => e.payload.t === 'debt_payment_recorded')).toHaveLength(1);
    expect(screen.getByTestId(`cash-${farm.nat}`)).toHaveTextContent(/561\.25/);
    expect(screen.getByTestId(`pm-${farm.nat}-share`)).toHaveTextContent(/\+2,061\.25$/);
    expect(screen.getByTestId(`pay-route-${farm.nat}`)).toHaveTextContent(/−1,500\.00$/);
    expect(screen.getByTestId('owner-transfer')).toHaveTextContent(/7,198\.75/);
    await press('to-rounding');
    expect(screen.getByTestId('rounding-sheet')).toBeTruthy();
    await press('round-worker');
    router.push.mockClear();
    await doubleTap('round-confirm');
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenLastCalledWith(`/v2/sale/${SALE}/tally`);
  });

  it('tally: every pile adds up to the sale', async () => {
    await inSale(<TallyScreen />);
    expect(screen.getByTestId('tally-ok')).toBeTruthy();
    expect(screen.getByTestId('tally-sum')).toHaveTextContent(/11,397\.50/);
  });

  it('tally: shows the sale in detail (E05-S08), as page 16 does', async () => {
    await inSale(<TallyScreen />);
    expect(screen.getByTestId('tally-weight')).toHaveTextContent(/235 กก\./);
    expect(screen.getByTestId('tally-baskets')).toHaveTextContent(/5 เข่ง/);
    expect(screen.getByTestId('tally-total')).toHaveTextContent(/11,397\.50/);
    expect(screen.getByTestId(`tally-tapper-${farm.red}`)).toHaveTextContent(/150 กก\./);
    expect(screen.getByTestId(`tally-tapper-${farm.nat}`)).toHaveTextContent(/85 กก\./);
    expect(screen.getByTestId('tally-sale')).toHaveTextContent(/11,397\.50/);
  });

  it('tally: each pile says where it comes from, and the parts add up to the cash', async () => {
    await inSale(<TallyScreen />);
    // แดง: share 3,637.50 rounded up 0.50 → 3,638.00.
    expect(screen.getByTestId(`tally-from-${farm.red}`)).toHaveTextContent(/^จากยอดขาย3,637\.50ปัดเศษ\+0\.50$/);
    expect(screen.getByTestId(`tally-cash-${farm.red}`)).toHaveTextContent(/3,638\.00$/);
    // นัด: share 2,061.25, the 1,500 debt taken with the owner's transfer, rounded up 0.75 → 562.00.
    expect(screen.getByTestId(`tally-from-${farm.nat}`)).toHaveTextContent(/^จากยอดขาย2,061\.25↘ นัด → สวน จ่ายหนี้−1,500\.00ปัดเศษ\+0\.75$/);
    expect(screen.getByTestId(`tally-cash-${farm.nat}`)).toHaveTextContent(/562\.00$/);
    expect(screen.queryByTestId(`tally-net-${farm.nat}`)).toBeNull();
    // Owner: the transfer is his share plus the 1,500 repaid with it.
    expect(screen.getByTestId('tally-owner-from')).toHaveTextContent(/^จากยอดขาย5,698\.75↘ เงินจากนัด \(มากับยอดโอน\)\+1,500\.00ปัดเศษ−1\.25$/);
    // three checks: the sale parts add to the sale, the debt moves and the rounding each add to 0
    expect(screen.getByTestId('tally-check-sale')).toHaveTextContent(/11,397\.50/);
    expect(screen.getByTestId('tally-check-debt')).toHaveTextContent(/= 0\.00/);
    expect(screen.getByTestId('tally-check-round')).toHaveTextContent(/= 0\.00/);
    expect(screen.getByTestId('tally-transfer')).toHaveTextContent(/7,197\.50$/);
    expect(screen.getByTestId('tally-sum')).toHaveTextContent('11,397.50');
    expect(screen.getByTestId('tally-sale')).toHaveTextContent(/11,397\.50$/);
    expect(screen.getByTestId('tally-ok')).toBeTruthy();
  });

  it('payment: each payee ticks on its own; close completes the sale', async () => {
    await inSale(<PaymentScreen />);
    expect(screen.getByTestId(`tick-amt-${farm.red}`)).toHaveTextContent('3,638');
    // E05-S09: the same person card as the share summary.
    expect(screen.getByTestId(`pm-${farm.nat}-share`)).toHaveTextContent(/\+2,061\.25$/);
    expect(screen.getByTestId(`pay-route-${farm.nat}`)).toHaveTextContent(/−1,500\.00$/);
    await doubleTap(`tick-${farm.red}`);
    expect(screen.getByTestId(`tick-${farm.red}`).props.accessibilityState).toMatchObject({ checked: true });
    expect((await financeStore.load()).filter((e) => e.payload.t === 'payment_mark_set')).toHaveLength(1);
    router.replace.mockClear();
    await press('close-sale');
    // One navigation, no tick race: the sale's whole stack is popped for the list
    // (home → sales), and no screen of it sends the closed sale to /payment (re-review N3).
    expect(router.dismissTo).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).toHaveBeenCalledWith('/v2/sales');
    expect(router.replace).not.toHaveBeenCalled();
    const ev = await store().load(SALE);
    expect(ev.some((e) => e.kind === 'sys' && e.payload.t === 'sale_status_set' && e.payload.status === 'completed')).toBe(true);
  });

  it('a closed sale is read-only: no deduction, account, rounding or check (review #2)', async () => {
    const s = await inSale(<SettlementScreen />);
    expect(screen.queryByTestId(`deduct-${farm.nat}`)).toBeNull();
    expect(screen.queryByTestId('account-change')).toBeNull();
    s.unmount();
    const c = await inSale(<CheckScreen />);
    expect(screen.queryByTestId('check-match')).toBeNull();
    c.unmount();
    await inSale(<PaymentScreen />);
    expect(screen.queryByTestId('close-sale')).toBeNull();
  });

  it('after close, payment ticks stay open: tick, untick and tick again (owner, option ก)', async () => {
    const tick = () => screen.getAllByTestId(`tick-${farm.nat}`).pop()!;
    await inSale(<PaymentScreen />);
    expect(tick().props.accessibilityState).toMatchObject({ disabled: false, checked: false });
    await press(`tick-${farm.nat}`);
    expect(tick().props.accessibilityState).toMatchObject({ checked: true });
    await press(`tick-${farm.nat}`);
    expect(tick().props.accessibilityState).toMatchObject({ checked: false });
    // The sale itself stays closed and untouched.
    const ev = await store().load(SALE);
    expect(ev.filter((e) => e.kind === 'sys' && e.payload.t === 'sale_status_set')).toHaveLength(1);
  });
});

describe('closing waits for the piles, the rounding and any tick conflict (review #5, #6)', () => {
  const OTHER = 'sale-money-2';
  beforeAll(async () => {
    const b = new LogBuilder(OTHER);
    b.sys({ t: 'sale_started', farmName: '', buyer: 'x', manager: '', workerLead: '', where: 'farm' });
    b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
    b.sys({ t: 'pile_added', pileId: farm.a[3], zoneId: farm.farmA, name: 'p', tareG: 2_000, stdNetG: 50_000 });
    b.acceptAt(farm.a[3], 1).shortAt(farm.a[3], 2, 37_000);
    await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
  });
  const inOther = async (ui: ReactElement) => {
    const r = wrap(<SaleProvider saleId={OTHER}>{ui}</SaleProvider>);
    await flush();
    return r;
  };

  it('rounding not answered (a fraction to round): close is off', async () => {
    await inOther(<PaymentScreen />);
    expect(screen.getByTestId('close-sale').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('a tick in conflict between two phones: ticks and close are off', async () => {
    for (const done of [true, false]) {
      await writeFinance(`payment-${OTHER}-${farm.nat}`, null, { t: 'payment_mark_set', saleId: OTHER, payee: farm.nat, done, amountSatang: 1 });
    }
    await inOther(<PaymentScreen />);
    expect(screen.getByTestId(`tick-${farm.nat}`).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('pay-conflict')).toBeTruthy();
    expect(screen.getByTestId('close-sale').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('closed sale routes (re-review N4)', () => {
  it('/rounding of a closed sale goes to its payment and opens no sheet', async () => {
    router.replace.mockClear();
    clearClosing(); // the list was never shown after the close above
    const r = wrap(
      <SaleProvider saleId={SALE}>
        <SettlementScreen rounding />
      </SaleProvider>,
    );
    await flush();
    expect(screen.queryByTestId('rounding-sheet')).toBeNull();
    expect(router.replace).toHaveBeenCalledWith(`/v2/sale/${SALE}/payment`);
    r.unmount();
  });

  it('a write screen still mounted under a close does not send it to /payment (N3)', async () => {
    // The picker sits at the bottom of the sale stack; while a close is under way it must stay quiet.
    router.replace.mockClear();
    markClosing(SALE);
    wrap(
      <SaleProvider saleId={SALE}>
        <PointScreen />
      </SaleProvider>,
    );
    await flush();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('close stays off when the tally does not add up (re-review N5)', () => {
  const THIRD = 'sale-money-3';
  beforeAll(async () => {
    const b = new LogBuilder(THIRD);
    b.sys({ t: 'sale_started', farmName: '', buyer: 'x', manager: '', workerLead: '', where: 'farm' });
    b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
    b.sys({ t: 'pile_added', pileId: farm.a[0], zoneId: farm.farmA, name: 'p', tareG: 2_000, stdNetG: 50_000 });
    b.acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 2);
    await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
  });
  const inThird = async (ui: ReactElement) => {
    const r = wrap(<SaleProvider saleId={THIRD}>{ui}</SaleProvider>);
    await flush();
    return r;
  };

  it('whole baht, nothing to round: close is on while the piles add up, off once they do not', async () => {
    const r = await inThird(<PaymentScreen />);
    expect(screen.getByTestId('close-sale').props.accessibilityState).toMatchObject({ disabled: false });
    r.unmount();
    // A repayment "with the owner's transfer" by someone with no share in this sale:
    // it raises the transfer but not the sale, so the piles no longer add up.
    await writeFinance('dpay-stray', null, {
      t: 'debt_payment_recorded',
      fields: { worker: { id: 'stranger', name: 'x' }, creditor: { id: FARM_FUNDS, name: 'เงินสวน' }, amountSatang: 10_000, date: '2026-10-03', note: '', method: 'transfer-with-owner', saleId: THIRD },
    });
    await inThird(<TallyScreen />);
    expect(screen.getByTestId('tally-off')).toBeTruthy();
    await inThird(<PaymentScreen />);
    expect(screen.getAllByTestId('close-sale').pop()!.props.accessibilityState).toMatchObject({ disabled: true });
  });
});


describe('tally detail edge cases (E05-S08)', () => {
  const inSaleId = async (id: string, ui: ReactElement) => {
    const r = wrap(<SaleProvider saleId={id}>{ui}</SaleProvider>);
    await flush();
    return r;
  };

  it('a voided basket is not in the weight, the baskets or the amounts', async () => {
    const ID = 'sale-money-void';
    const b = new LogBuilder(ID);
    b.sys({ t: 'sale_started', farmName: '', buyer: 'x', manager: '', workerLead: '', where: 'farm' });
    b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
    b.sys({ t: 'pile_added', pileId: farm.a[0], zoneId: farm.farmA, name: 'p', tareG: 2_000, stdNetG: 50_000 });
    b.acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 2);
    const target = b.nextId();
    b.acceptAt(farm.a[0], 3);
    b.void(farm.a[0], target);
    await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
    await inSaleId(ID, <TallyScreen />);
    expect(screen.getByTestId('tally-weight')).toHaveTextContent(/100 กก\./);
    expect(screen.getByTestId('tally-baskets')).toHaveTextContent(/2 เข่ง/);
    expect(screen.getByTestId('tally-total')).toHaveTextContent(/4,850\.00/);
    expect(screen.getByTestId(`tally-tapper-${farm.red}`)).toHaveTextContent(/100 กก\./);
    expect(screen.getByTestId('tally-ok')).toBeTruthy();
  });

  it('a sale with no baskets yet: no tapper rows, nothing to add up, no crash', async () => {
    const ID = 'sale-money-empty';
    const b = new LogBuilder(ID);
    b.sys({ t: 'sale_started', farmName: '', buyer: 'x', manager: '', workerLead: '', where: 'farm' });
    b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
    await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
    await inSaleId(ID, <TallyScreen />);
    expect(screen.getByTestId('tally-weight')).toHaveTextContent(/0 กก\./);
    expect(screen.getByTestId('tally-total')).toHaveTextContent(/0\.00/);
    expect(screen.queryByTestId(`tally-tapper-${farm.red}`)).toBeNull();
    expect(screen.getByTestId('tally-sum')).toHaveTextContent(/0\.00/);
  });
});
