import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { LogBuilder } from '../core/fixtures';
import { FARM_FUNDS, type DebtPaymentMethod } from '../core/finance/types';
import { financeStore } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { CloseoutPayScreen } from '../v2/sale/closeout/pay-screen';

/**
 * E05-S11 · จ่ายเงิน · ปิดการขาย (CO-10, CO-25; mockup A9, A19, A20). The
 * deductions are already confirmed (recorded), so these seed the finance log
 * the way "ยืนยันยอด" leaves it, then check every rule PaymentBody kept.
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
const FARM = { id: FARM_FUNDS, name: 'เงินสวน' };
let farm: MockFarm;

/**
 * The story's sale (28,875.00 at 50 ฿/kg): แดง 367.5 kg → share 9,187.50;
 * นัด 210 kg → share 5,250.00; owner 14,437.50.
 */
async function storySale(id: string) {
  const b = new LogBuilder(id);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 5000, indexRef: '' });
  for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
  for (let n = 1; n <= 7; n++) b.acceptAt(farm.a[0], n);
  b.shortAt(farm.a[0], 8, 19_500);
  for (let n = 1; n <= 4; n++) b.acceptAt(farm.a[3], n);
  b.shortAt(farm.a[3], 5, 12_000);
  await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
}

/** What "ยืนยันยอด" leaves: one line per worker by its route, and the rounding. */
async function confirmed(saleId: string, red: { amount: number; method: DebtPaymentMethod }, nat: { amount: number; method: DebtPaymentMethod }, mode: 'worker' | 'none' | 'owner' = 'worker') {
  await writeFinance(`dp-${saleId}-red`, null, { t: 'debt_payment_recorded', fields: { worker: { id: farm.red, name: 'แดง' }, creditor: FARM, amountSatang: red.amount, date: '2026-10-29', note: '', method: red.method, saleId } });
  await writeFinance(`dp-${saleId}-nat`, null, { t: 'debt_payment_recorded', fields: { worker: { id: farm.nat, name: 'นัด' }, creditor: FARM, amountSatang: nat.amount, date: '2026-10-29', note: '', method: nat.method, saleId } });
  await writeFinance(`sale-rounding-${saleId}`, null, { t: 'sale_rounding_set', saleId, mode });
}

const inSale = async (saleId: string, ui: ReactElement) => {
  const r = wrap(<SaleProvider saleId={saleId}>{ui}</SaleProvider>);
  await flush();
  return r;
};

beforeAll(async () => {
  farm = await seedMockFarm(master());
  // Plenty of debt for every sale below (the balance is per worker, across sales).
  await writeFinance('debt-red', null, { t: 'debt_added', fields: { worker: { id: farm.red, name: 'แดง' }, kind: 'loan', amountSatang: 10_000_000, date: '2026-09-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
  await writeFinance('debt-nat', null, { t: 'debt_added', fields: { worker: { id: farm.nat, name: 'นัด' }, kind: 'loan', amountSatang: 10_000_000, date: '2026-09-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
});

describe('CO-10 · story example (A9): โอนรวม + ให้คนกรีด', () => {
  const S = 'co-pay-story';
  beforeAll(async () => {
    await storySale(S);
    await confirmed(S, { amount: 325_000, method: 'transfer-with-owner' }, { amount: 525_000, method: 'transfer-with-owner' });
  });

  it('step bar, tally strip, แดง 5,938.00 with its sub line, นัด an info line with no tick', async () => {
    await inSale(S, <CloseoutPayScreen />);
    expect(screen.getByTestId('pay-step')).toHaveTextContent(/ขั้น 3 จาก 3/);
    expect(screen.getByTestId('pay-tally')).toHaveTextContent(/ยอดตรงกันแล้ว/);
    expect(screen.getByTestId(`tick-${farm.red}`)).toHaveTextContent(/จ่ายเงินสดให้แดงแล้ว/);
    expect(screen.getByTestId(`tick-amt-${farm.red}`)).toHaveTextContent('5,938.00');
    expect(screen.getByTestId(`pay-sub-${farm.red}`)).toHaveTextContent(/ส่วนแบ่ง 9,187\.50 − หนี้ 3,250\.00 ปัด \+0\.50/);
    expect(screen.queryByTestId(`tick-${farm.nat}`)).toBeNull();
    expect(screen.getByTestId(`pay-info-${farm.nat}`)).toHaveTextContent('นัดไม่มีเงินสดต้องจ่ายวันนี้ (หักหนี้หมดส่วนแบ่ง)');
    expect(screen.queryByTestId(`tick-debt-cash-${farm.red}`)).toBeNull();
  });

  it('the transfer 22,937.00 split "ส่วนสวน + ↘ คืนหนี้", chip "รอรับโอน" until ticked; unticked rows counted', async () => {
    await inSale(S, <CloseoutPayScreen />);
    expect(last('tick-owner')).toHaveTextContent(/เจ้าของได้รับเงินโอนแล้ว/);
    expect(last('tick-amt-owner')).toHaveTextContent('22,937.00');
    expect(last('pay-sub-owner')).toHaveTextContent(/ส่วนสวน 14,437\.00 \+ ↘ คืนหนี้ 8,500\.00/);
    expect(last('pay-chip-owner')).toHaveTextContent(/↘ คืนหนี้ .*8,500 รอรับโอน/);
    expect(last('pay-left')).toHaveTextContent('ยังไม่ติ๊ก 2 รายการ');
    await press('tick-owner');
    expect(last('tick-owner').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.queryByTestId('pay-chip-owner')).toBeNull();
    expect(last('pay-left')).toHaveTextContent('ยังไม่ติ๊ก 1 รายการ');
    const marks = (await financeStore.load()).filter((e) => e.payload.t === 'payment_mark_set' && e.payload.saleId === S);
    expect(marks.map((e) => e.targetId)).toEqual([`payment-${S}-owner`]);
  });

  it('SET-6: closing with unticked rows is allowed; it completes the sale and leaves for the list', async () => {
    router.dismissTo.mockClear();
    await inSale(S, <CloseoutPayScreen />);
    expect(last('close-sale').props.accessibilityState).toMatchObject({ disabled: false });
    await press('close-sale');
    expect(router.dismissTo).toHaveBeenCalledWith('/v2/sales');
  });

  it('ticks stay open after close; the close button is gone', async () => {
    await inSale(S, <CloseoutPayScreen />);
    expect(screen.queryByTestId('close-sale')).toBeNull();
    expect(last(`tick-${farm.red}`).props.accessibilityState).toMatchObject({ disabled: false });
    await press(`tick-${farm.red}`);
    expect(last(`tick-${farm.red}`).props.accessibilityState).toMatchObject({ checked: true });
  });
});

describe('CO-25 · buyer-split (A19)', () => {
  const S = 'co-pay-split';
  beforeAll(async () => {
    await storySale(S);
    await confirmed(S, { amount: 325_000, method: 'buyer-split' }, { amount: 525_000, method: 'transfer-with-owner' });
  });

  it('its own tick "รับเงินสดคืนหนี้แล้ว · แดง" with "รอรับเงินสด" until ticked', async () => {
    await inSale(S, <CloseoutPayScreen />);
    const id = `tick-debt-cash-${farm.red}`;
    expect(last(id)).toHaveTextContent(/รับเงินสดคืนหนี้แล้ว · แดง/);
    expect(last(id)).toHaveTextContent(/คนซื้อแยกเงินสด/);
    expect(last(`tick-amt-debt-cash-${farm.red}`)).toHaveTextContent('3,250.00');
    expect(last(`pay-chip-debt-cash-${farm.red}`)).toHaveTextContent(/รอรับเงินสด/);
    expect(last('tick-amt-owner')).toHaveTextContent('19,687.00');
    expect(last('pay-sub-owner')).toHaveTextContent(/ส่วนสวน 14,437\.00 \+ ↘ คืนหนี้นัด 5,250\.00/);
    expect(last('pay-left')).toHaveTextContent('ยังไม่ติ๊ก 3 รายการ');
    await press(id);
    expect(last(id).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.queryByTestId(`pay-chip-debt-cash-${farm.red}`)).toBeNull();
    // ticking the farm's cash does not tick the worker's
    expect(last(`tick-${farm.red}`).props.accessibilityState).toMatchObject({ checked: false });
  });
});

describe('CO-25 · cash-from-share (A20)', () => {
  const S = 'co-pay-pick';
  beforeAll(async () => {
    await storySale(S);
    await confirmed(S, { amount: 325_000, method: 'cash-from-share' }, { amount: 525_000, method: 'transfer-with-owner' }, 'none');
  });

  it('the repayment ticks together with the worker, and can be unticked on its own', async () => {
    await inSale(S, <CloseoutPayScreen />);
    const pay = `tick-${farm.red}`;
    const repay = `tick-debt-cash-${farm.red}`;
    expect(last(`tick-amt-${farm.red}`)).toHaveTextContent('5,937.50');
    expect(last(`pay-sub-${farm.red}`)).toHaveTextContent(/เงินแดง 9,187\.50 − สวนหยิบคืน 3,250\.00 · ไม่ปัด/);
    expect(last(repay)).toHaveTextContent(/หยิบจากเงินแดง/);
    expect(last(`pay-chip-debt-cash-${farm.red}`)).toHaveTextContent(/รอรับเงินสด/);
    await press(pay);
    expect(last(pay).props.accessibilityState).toMatchObject({ checked: true });
    expect(last(repay).props.accessibilityState).toMatchObject({ checked: true });
    expect(last(repay)).toHaveTextContent(/ติ๊กพร้อมกับจ่ายแดง \(แก้ได้\)/);
    await press(repay);
    expect(last(repay).props.accessibilityState).toMatchObject({ checked: false });
    expect(last(pay).props.accessibilityState).toMatchObject({ checked: true });
  });
});

describe('D-29 · ticks in conflict block ticking and closing', () => {
  const S = 'co-pay-conflict';
  beforeAll(async () => {
    await storySale(S);
    await confirmed(S, { amount: 325_000, method: 'transfer-with-owner' }, { amount: 525_000, method: 'transfer-with-owner' });
    for (const done of [true, false]) {
      await writeFinance(`payment-${S}-${farm.red}`, null, { t: 'payment_mark_set', saleId: S, payee: farm.red, done, amountSatang: 593_800 });
    }
  });

  it('banner, ticks off, close off', async () => {
    await inSale(S, <CloseoutPayScreen />);
    expect(screen.getByTestId('pay-conflict')).toBeTruthy();
    expect(last(`tick-${farm.red}`).props.accessibilityState).toMatchObject({ disabled: true });
    expect(last('tick-owner').props.accessibilityState).toMatchObject({ disabled: true });
    expect(last('close-sale').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('D-61 · deducted over the share blocks ticks and close', () => {
  const S = 'co-pay-over';
  beforeAll(async () => {
    await storySale(S);
    await confirmed(S, { amount: 325_000, method: 'transfer-with-owner' }, { amount: 600_000, method: 'transfer-with-owner' });
  });

  it('banner, the owner tick and close off', async () => {
    await inSale(S, <CloseoutPayScreen />);
    expect(screen.getByTestId('pay-over')).toBeTruthy();
    expect(last('tick-owner').props.accessibilityState).toMatchObject({ disabled: true });
    expect(last('close-sale').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('rounding not answered: close off', () => {
  const S = 'co-pay-unrounded';
  beforeAll(async () => {
    await storySale(S);
    await writeFinance(`dp-${S}-red`, null, { t: 'debt_payment_recorded', fields: { worker: { id: farm.red, name: 'แดง' }, creditor: FARM, amountSatang: 325_000, date: '2026-10-29', note: '', method: 'transfer-with-owner', saleId: S } });
  });

  it('a fraction left to round keeps close off', async () => {
    await inSale(S, <CloseoutPayScreen />);
    expect(last('close-sale').props.accessibilityState).toMatchObject({ disabled: true });
  });
});
