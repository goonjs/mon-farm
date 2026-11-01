import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { LogBuilder } from '../core/fixtures';
import { FARM_FUNDS, type DebtPaymentMethod } from '../core/finance/types';
import { paymentMarkPayload, paymentTarget } from '../core/finance/payments';
import { financeStore } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { CloseoutPayScreen } from '../v2/sale/closeout/pay-screen';

jest.setTimeout(20_000);

/**
 * E06-S08 on the sale's payment page (mockup P1, P2 · PR-16, PR-17, PR-20 ·
 * D-87): money that came in short ("ได้น้อยกว่านี้ ›" → คนซื้อค้างสวน chip),
 * a cash-from-share repayment that was not (fully) lifted ("ไม่ได้หยิบ /
 * หยิบไม่ครบ ›" → the deduction shrinks), and the sources sheet's
 * "ได้จริง + คนซื้อค้างสวน = ยอดขาย".
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
const type = async (pad: string, digits: string) => {
  for (const d of digits) await act(async () => fireEvent.press(last(`${pad}-key-${d}`)));
};
const FARM = { id: FARM_FUNDS, name: 'เงินสวน' };
let farm: MockFarm;

/** 28,875.00: แดง share 9,187.50, นัด share 5,250.00, owner 14,437.50. */
async function storySale(id: string) {
  const b = new LogBuilder(id);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'ลานยางสมบูรณ์', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 5000, indexRef: '' });
  for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
  for (let n = 1; n <= 7; n++) b.acceptAt(farm.a[0], n);
  b.shortAt(farm.a[0], 8, 19_500);
  for (let n = 1; n <= 4; n++) b.acceptAt(farm.a[3], n);
  b.shortAt(farm.a[3], 5, 12_000);
  await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
}

async function confirmed(saleId: string, red: { amount: number; method: DebtPaymentMethod }, nat: { amount: number; method: DebtPaymentMethod }, mode: 'worker' | 'none' | 'owner' = 'none') {
  await writeFinance(`dp-${saleId}-red`, null, { t: 'debt_payment_recorded', fields: { worker: { id: farm.red, name: 'แดง' }, creditor: FARM, amountSatang: red.amount, date: '2026-11-01', note: '', method: red.method, saleId } });
  await writeFinance(`dp-${saleId}-nat`, null, { t: 'debt_payment_recorded', fields: { worker: { id: farm.nat, name: 'นัด' }, creditor: FARM, amountSatang: nat.amount, date: '2026-11-01', note: '', method: nat.method, saleId } });
  await writeFinance(`sale-rounding-${saleId}`, null, { t: 'sale_rounding_set', saleId, mode });
}

const inSale = async (saleId: string, ui: ReactElement) => {
  const r = wrap(<SaleProvider saleId={saleId}>{ui}</SaleProvider>);
  await flush();
  return r;
};
const marks = async (saleId: string) => (await financeStore.load()).filter((e) => e.payload.t === 'payment_mark_set' && e.payload.saleId === saleId);

beforeAll(async () => {
  farm = await seedMockFarm(master());
  await writeFinance('debt-red', null, { t: 'debt_added', fields: { worker: { id: farm.red, name: 'แดง' }, kind: 'loan', amountSatang: 1_000_000, date: '2026-09-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
  await writeFinance('debt-nat', null, { t: 'debt_added', fields: { worker: { id: farm.nat, name: 'นัด' }, kind: 'loan', amountSatang: 1_000_000, date: '2026-09-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
});

describe('P2 · PR-16 the owner transfer came in short', () => {
  const S = 'rp-pay-transfer';
  beforeAll(async () => {
    await storySale(S);
    await confirmed(S, { amount: 325_000, method: 'buyer-split' }, { amount: 525_000, method: 'transfer-with-owner' });
  });

  it('"ได้น้อยกว่านี้ ›" under the owner row (48 tall) opens the transfer amount sheet; save ticks with what came in', async () => {
    await inSale(S, <CloseoutPayScreen />);
    expect(last('tick-amt-owner')).toHaveTextContent('19,687.50');
    expect(screen.queryByTestId('pay-owes-owner')).toBeNull();
    const link = last('pay-less-owner');
    expect(link).toHaveTextContent('ได้น้อยกว่านี้ ›');
    const st = [link.props.style].flat(Infinity).filter(Boolean).reduce((a: object, x: object) => ({ ...a, ...x }), {}) as { minHeight?: number };
    expect(st.minHeight).toBeGreaterThanOrEqual(48);
    await press('pay-less-owner');
    const sheet = last('rp-amount-sheet');
    expect(sheet).toHaveTextContent(/ได้เงินโอนทั้งก้อนเท่าไหร่/);
    expect(within(sheet).getByTestId('rp-amt-debt')).toHaveTextContent(/หนี้นัด ไม่เปลี่ยน/);
    await type('rp-amt-pad', '17000');
    await press('rp-amt-save');
    expect(screen.queryByTestId('rp-amount-sheet')).toBeNull();
    const ms = await marks(S);
    expect(ms).toHaveLength(1);
    expect(ms[0].payload).toMatchObject({ payee: 'owner', done: true, amountSatang: 1_968_750, receivedSatang: 1_700_000 });
    expect(last('tick-owner').props.accessibilityState).toMatchObject({ checked: true });
    expect(last('pay-owes-owner')).toHaveTextContent('คนซื้อค้างสวน ฿ 2,688');
  });

  it('the cash repayment row: short to nothing → its own chip; the picked-fix link is not there', async () => {
    await inSale(S, <CloseoutPayScreen />);
    const id = `debt-cash-${farm.red}`;
    expect(screen.queryByTestId(`pay-pickfix-${id}`)).toBeNull();
    await press(`pay-less-${id}`);
    expect(last('rp-amount-sheet')).toHaveTextContent(/ได้เงินสดคืนหนี้เท่าไหร่/);
    await press('rp-amt-save');
    const m = (await marks(S)).find((e) => e.targetId.endsWith(id))!;
    expect(m.payload).toMatchObject({ done: true, amountSatang: 325_000, receivedSatang: 0 });
    expect(last(`pay-owes-${id}`)).toHaveTextContent('คนซื้อค้างสวน ฿ 3,250');
  });

  it('PR-20: ดูที่มา shows ได้จริง + คนซื้อค้างสวน = ยอดขาย', async () => {
    await inSale(S, <CloseoutPayScreen />);
    await press('pay-sources-open');
    const sheet = last('co-sources-sheet');
    expect(within(sheet).getByTestId('co-src-received')).toHaveTextContent(/ได้จริง\s*22,937\.50/);
    expect(within(sheet).getByTestId('co-src-owes')).toHaveTextContent(/คนซื้อค้างสวน.*5,937\.50/);
    expect(within(sheet).getByTestId('co-src-owes-detail')).toHaveTextContent(/ขาดโอน 2,687\.50 · เงินสดคืนหนี้แดง 3,250\.00/);
    expect(within(sheet).getByTestId('co-src-equation')).toHaveTextContent('ได้จริง + คนซื้อค้างสวน = ยอดขาย');
  });
});

describe('PR-19 · the buyer handed the transfer repayment to the worker', () => {
  const S = 'rp-pay-handed';
  beforeAll(async () => {
    await storySale(S);
    // นัด's debt is shared with the sales above: 4,000 here keeps it within what he owes (else D-61 locks the page).
    await confirmed(S, { amount: 325_000, method: 'buyer-split' }, { amount: 400_000, method: 'transfer-with-owner' });
    await writeFinance(paymentTarget(S, 'owner'), null, paymentMarkPayload(S, 'owner', true, 1_843_750));
  });

  it('PR-19 "คนซื้อให้นัดไปแล้ว" → แก้ที่การขาย: the fix sheet for นัด\'s transfer line; nothing reached the farm → the line is voided, kept in the history', async () => {
    await inSale(S, <CloseoutPayScreen />);
    await press('pay-less-owner');
    // the transfer sheet names the buyer and whose repayment rides on it (PR-15 / owner Q2)
    expect(last('rp-amount-sheet')).toHaveTextContent(/ลานยางสมบูรณ์ · รวมคืนหนี้นัด/);
    await press('rp-amt-with-worker');
    await press('rp-amt-fix');
    expect(screen.queryByTestId('rp-amount-sheet')).toBeNull();
    expect(last('rp-pick-sheet')).toHaveTextContent(/เงินคืนหนี้นัด ถึงสวนเท่าไหร่/);
    await press('rp-pick-save');
    const evs = await financeStore.load();
    const nat = evs.filter((e) => e.targetId === `dp-${S}-nat`);
    expect(nat.map((e) => e.payload.t)).toEqual(['debt_payment_recorded', 'debt_payment_changed']);
    expect(nat[1].payload).toMatchObject({ patch: { deleted: true } });
    // the owner's tick no longer matches the (smaller) transfer: it asks for a recheck
    expect(last('tick-owner')).toHaveTextContent(/ต้องตรวจใหม่/);
  });

});

describe('P1 · PR-17 cash-from-share not (fully) lifted', () => {
  const S = 'rp-pay-pick';
  beforeAll(async () => {
    await storySale(S);
    await confirmed(S, { amount: 100_000, method: 'cash-from-share' }, { amount: 525_000, method: 'transfer-with-owner' });
  });

  it('"ไม่ได้หยิบ / หยิบไม่ครบ ›" opens the pick sheet; saving shrinks the deduction and the cash tick needs a recheck', async () => {
    await inSale(S, <CloseoutPayScreen />);
    const id = `debt-cash-${farm.red}`;
    await press(`tick-${farm.red}`);
    expect(last(`tick-${id}`).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.queryByTestId(`pay-less-${id}`)).toBeNull();
    expect(last(`pay-pickfix-${id}`)).toHaveTextContent('ไม่ได้หยิบ / หยิบไม่ครบ ›');
    await press(`pay-pickfix-${id}`);
    const sheet = last('rp-pick-sheet');
    expect(sheet).toHaveTextContent(/หักไว้ 1,000\.00/);
    // debt now 10,000 − 3,250 − 3,250 (the two sales above) − 1,000 = 2,500; picked 400 → back to 3,100
    await type('rp-pick-pad', '400');
    expect(within(sheet).getByTestId('rp-pick-debt')).toHaveTextContent(/3,100\.00/);
    await press('rp-pick-save');
    expect(screen.queryByTestId('rp-pick-sheet')).toBeNull();
    // the old line is voided (struck through in the history), a new pick line holds what was lifted (PR-17)
    const evs = await financeStore.load();
    const ch = evs.filter((e) => e.payload.t === 'debt_payment_changed' && e.targetId === `dp-${S}-red`);
    expect(ch).toHaveLength(1);
    expect(ch[0].payload).toMatchObject({ patch: { deleted: true } });
    const fresh = evs.filter((e) => e.payload.t === 'debt_payment_recorded' && e.targetId !== `dp-${S}-red` && (e.payload.fields as { saleId?: string }).saleId === S && (e.payload.fields as { worker: { id: string } }).worker.id === farm.red);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].payload).toMatchObject({ fields: { method: 'cash-from-share', amountSatang: 40_000 } });
    expect(last(`tick-amt-${id}`)).toHaveTextContent('400.00');
    expect(last(`tick-${farm.red}`)).toHaveTextContent(/ต้องตรวจใหม่/);
  });
});

describe('PR-20: nothing came in short → the sources sheet reads as before', () => {
  const S = 'rp-pay-full';
  beforeAll(async () => {
    await storySale(S);
    await confirmed(S, { amount: 325_000, method: 'transfer-with-owner' }, { amount: 525_000, method: 'transfer-with-owner' });
  });

  it('nothing short: no ได้จริง / คนซื้อค้างสวน lines in the sheet', async () => {
    await inSale(S, <CloseoutPayScreen />);
    await press('pay-sources-open');
    const sheet = last('co-sources-sheet');
    expect(within(sheet).queryByTestId('co-src-received')).toBeNull();
    expect(within(sheet).queryByTestId('co-src-equation')).toBeNull();
  });
});
