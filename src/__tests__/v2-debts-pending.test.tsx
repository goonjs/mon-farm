import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { OWNER_PAYEE, paymentMarkPayload, paymentStatus, paymentTarget } from '../core/finance/payments';
import { FARM_FUNDS, type DebtPaymentFields, type FinancePayload } from '../core/finance/types';
import { writeFinance } from '../store/finance-write';
import { DebtAccountScreen, DebtsScreen } from '../v2/money/debts-screens';
import { financeStore } from '../store/finance';
import type { MasterStore } from '../store/master-store';
import type { EventStore } from '../store/store';
import { LogBuilder } from '../core/fixtures';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';

// Whole screens with a sale's money inside the sheet: slow on CI runners.
jest.setTimeout(20_000);

/**
 * E06-S08 · repayments not received yet on the debt ledger (mockup M1–M7,
 * M9, M10, P3 · PR-1…PR-15, PR-19 · D-87). The sale is the E05-S11 example:
 * ขาย 28,875.00 · แดง share 9,187.50, หัก 3,250 by buyer-split cash · นัด
 * share 5,250.00, หัก 5,250 in the owner's transfer.
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
  const params: { current: Record<string, string> } = { current: {} };
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => params.current,
    useRouter: () => router,
    router,
    __params: params,
  };
});
const { __params: params, router } = jest.requireMock('expo-router') as { __params: { current: Record<string, string> }; router: { push: jest.Mock } };
const master = () => (jest.requireMock('../store/people') as { peopleStore: MasterStore }).peopleStore;
const store = () => (jest.requireMock('../store/store') as { store: EventStore }).store;

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}
const press = async (id: string) => {
  await act(async () => fireEvent.press(screen.getByTestId(id)));
  await flush();
};
const text = (id: string) => screen.getByTestId(id);
const SALE = 'sale-rp';
const FARM = { id: FARM_FUNDS, name: 'เงินสวน' };
let farm: MockFarm;
let n = 0;

const loan = (worker: { id: string; name: string }, amountSatang: number): FinancePayload => ({
  t: 'debt_added',
  fields: { worker, kind: 'loan', amountSatang, date: '2026-10-01', note: '', lender: FARM, fertilizer: null, carriedForward: false },
});
const deduct = (worker: { id: string; name: string }, amountSatang: number, method: DebtPaymentFields['method'], date = '2026-11-05', saleId = SALE): FinancePayload => ({
  t: 'debt_payment_recorded',
  fields: { worker, creditor: FARM, amountSatang, date, note: '', method, saleId },
});
const status = async (payee: string) => paymentStatus(await financeStore.load(), SALE, payee, 0);
const ownerTick = async () => status(OWNER_PAYEE);
const cashTick = async (id: string) => status(`debt-cash-${id}`);

/** A fresh finance log per case: the memory store keeps every append. */
const resetFinance = () => (financeStore as unknown as { rows: Map<string, unknown> }).rows.clear();

beforeAll(async () => {
  farm = await seedMockFarm(master());
  const b = new LogBuilder(SALE);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 5250, indexRef: '' });
  for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
  for (let i = 1; i <= 7; i++) b.acceptAt(farm.a[0], i);
  for (let i = 1; i <= 4; i++) b.acceptAt(farm.a[3], i);
  await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
});

beforeEach(async () => {
  resetFinance();
  router.push.mockClear();
  n += 1;
  const RED = { id: farm.red, name: 'แดง' };
  const NAT = { id: farm.nat, name: 'นัด' };
  await writeFinance(`d-red-${n}`, null, loan(RED, 1_579_000));
  await writeFinance(`d-nat-${n}`, null, loan(NAT, 835_000));
  await writeFinance(`dp-red-${n}`, null, deduct(RED, 325_000, 'buyer-split'));
  await writeFinance(`dp-nat-${n}`, null, deduct(NAT, 525_000, 'transfer-with-owner'));
});

describe('the debt list (M1 · PR-4, PR-12)', () => {
  it('a summary card on top: per person, then Σ on its own line; each waiting row has a chip', async () => {
    wrap(<DebtsScreen />);
    await flush();
    expect(text('rp-list-sum')).toHaveTextContent(/รอเงินคืนหนี้เข้า.*แดง.*฿ 3,250.*นัด.*฿ 5,250/);
    expect(text('rp-list-sum-total')).toHaveTextContent(/Σ รอเงินเข้า.*฿ 8,500/);
    expect(text(`rp-list-chip-${farm.red}`)).toHaveTextContent(/หนี้ลดแล้ว · รอเงิน.*฿ 3,250/);
    expect(text(`rp-list-chip-${farm.nat}`)).toHaveTextContent(/฿ 5,250/);
    // the balance is after the deduction (D-85)
    expect(text(`debt-account-${farm.red}`)).toHaveTextContent(/12,540\.00/);
  });

  it('nothing waiting → no card, no chips', async () => {
    await writeFinance(paymentTarget(SALE, OWNER_PAYEE), null, paymentMarkPayload(SALE, OWNER_PAYEE, true, 1_968_750));
    await writeFinance(paymentTarget(SALE, `debt-cash-${farm.red}`), null, paymentMarkPayload(SALE, `debt-cash-${farm.red}`, true, 325_000));
    wrap(<DebtsScreen />);
    await flush();
    expect(screen.queryByTestId('rp-list-sum')).toBeNull();
    expect(screen.queryByTestId(`rp-list-chip-${farm.red}`)).toBeNull();
  });
});

describe('a worker\'s account (M2, M3, M5–M7, M9, P3 · PR-1, PR-2, PR-5–PR-7, PR-13, PR-15)', () => {
  it('the card under the balance: the sale, ↘ the repayment and who it waits on; the balance stays after the deduction', async () => {
    params.current = { workerId: farm.red, name: 'แดง' };
    wrap(<DebtAccountScreen />);
    await flush();
    expect(text('debt-balance')).toHaveTextContent('12,540.00');
    expect(text('rp-card')).toHaveTextContent(/เงินคืนหนี้ ยังไม่ได้รับ.*หนี้ลดแล้ว · รอเงินเข้าสวน/);
    expect(text(`rp-row-${SALE}-cash`)).toHaveTextContent(/↘ คืนหนี้ 3,250\.00.*รอเงินสดจากคนซื้อ/);
    expect(screen.queryByTestId('rp-card-total')).toBeNull();
  });

  it('ได้ครบ ticks the sale\'s repayment cash; the card goes, the history says รับเงินแล้ว, and เลิกทำ brings it back', async () => {
    params.current = { workerId: farm.red, name: 'แดง' };
    wrap(<DebtAccountScreen />);
    await flush();
    await press(`rp-row-${SALE}-cash`);
    expect(text('rp-sheet')).toHaveTextContent(/↘ คืนหนี้แดง.*3,250\.00.*คนซื้อแยกเงินสด/);
    await press('rp-sheet-full');
    expect(await cashTick(farm.red)).toMatchObject({ done: true, amountAtMarkSatang: 325_000, shortSatang: 0 });
    expect(screen.queryByTestId('rp-card')).toBeNull();
    expect(text('rp-undo')).toHaveTextContent(/บันทึกแล้ว · ได้ครบ 3,250\.00/);
    expect(screen.getByText('รับเงินแล้ว ›')).toBeTruthy();
    expect(text('debt-balance')).toHaveTextContent('12,540.00');
    await press('rp-undo-action');
    expect((await cashTick(farm.red)).done).toBe(false);
    expect(text('rp-card')).toBeTruthy();
  });

  it('transfer: the sheet shows the whole transfer to compare with the bank; ได้ครบ ticks the owner\'s transfer', async () => {
    params.current = { workerId: farm.nat, name: 'นัด' };
    wrap(<DebtAccountScreen />);
    await flush();
    await press(`rp-row-${SALE}-transfer`);
    expect(text('rp-sheet')).toHaveTextContent(/โอนรวมเข้าบัญชีสวน/);
    expect(text('rp-bundle')).toHaveTextContent(/ส่วนสวน.*↘ คืนหนี้นัด.*5,250\.00.*โอนรวม/);
    const total = text('rp-bundle-total').props.children as string;
    await press('rp-sheet-full');
    const tick = await ownerTick();
    expect(tick.done).toBe(true);
    expect(total).toContain((tick.amountAtMarkSatang! / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }));
    expect(screen.queryByTestId('rp-card')).toBeNull();
  });

  it('ได้น้อยกว่านี้: type what came in; the gap is the buyer\'s, the debt does not change (M7 · D-87)', async () => {
    params.current = { workerId: farm.red, name: 'แดง' };
    wrap(<DebtAccountScreen />);
    await flush();
    await press(`rp-row-${SALE}-cash`);
    await press('rp-sheet-less');
    for (const d of '1000') await press(`rp-amt-pad-key-${d}`);
    expect(text('rp-amt-owes')).toHaveTextContent(/คนซื้อค้างสวน.*2,250\.00/);
    expect(text('rp-amt-debt')).toHaveTextContent(/หนี้แดง ไม่เปลี่ยน.*12,540\.00/);
    await press('rp-amt-save');
    expect(await cashTick(farm.red)).toMatchObject({ done: true, receivedSatang: 100_000, shortSatang: 225_000 });
    expect(screen.queryByTestId('rp-card')).toBeNull();
    expect(screen.getByText('คนซื้อค้างสวน 2,250.00 ›')).toBeTruthy();
    expect(text('debt-balance')).toHaveTextContent('12,540.00');
  });

  it('0 = not received at all; more than expected cannot be saved', async () => {
    params.current = { workerId: farm.red, name: 'แดง' };
    wrap(<DebtAccountScreen />);
    await flush();
    await press(`rp-row-${SALE}-cash`);
    await press('rp-sheet-less');
    expect(text('rp-amt-save')).toHaveTextContent('บันทึก ไม่ได้รับ');
    for (const d of '4000') await press(`rp-amt-pad-key-${d}`);
    expect(text('rp-amt-over')).toHaveTextContent(/ใส่ได้ไม่เกิน 3,250\.00/);
    expect(text('rp-amt-save').props.accessibilityState?.disabled).toBe(true);
  });

  it('the buyer gave it to the worker → no tick, off to the sale to fix the deduction (PR-19)', async () => {
    params.current = { workerId: farm.red, name: 'แดง' };
    wrap(<DebtAccountScreen />);
    await flush();
    await press(`rp-row-${SALE}-cash`);
    await press('rp-sheet-less');
    await press('rp-amt-with-worker');
    expect(text('rp-amt-worker-holds')).toHaveTextContent('เงินอยู่กับแดง หนี้ยังไม่ได้จ่าย');
    await press('rp-amt-fix');
    expect(router.push).toHaveBeenCalledWith(`/v2/sale/${SALE}/payment?fix=${farm.red}&how=cash`);
    expect((await cashTick(farm.red)).done).toBe(false);
  });

  it('a received line in the history reopens the sheet: ยังไม่ได้รับ unticks it (PR-6, PR-13)', async () => {
    await writeFinance(paymentTarget(SALE, `debt-cash-${farm.red}`), null, paymentMarkPayload(SALE, `debt-cash-${farm.red}`, true, 325_000));
    params.current = { workerId: farm.red, name: 'แดง' };
    wrap(<DebtAccountScreen />);
    await flush();
    expect(screen.queryByTestId('rp-card')).toBeNull();
    await act(async () => fireEvent.press(screen.getByText('รับเงินแล้ว ›')));
    await flush();
    await press('rp-sheet-undo-tick');
    expect((await cashTick(farm.red)).done).toBe(false);
    expect(text('rp-card')).toBeTruthy();
    expect(text('rp-undo')).toHaveTextContent(/บันทึกแล้ว · ยังไม่ได้รับ/);
  });
});

describe('two sales and the picked route (M4, M10 · PR-3, PR-17)', () => {
  it('two sales waiting → one row each, oldest first, Σ on its own line', async () => {
    const RED = { id: farm.red, name: 'แดง' };
    await writeFinance(`dp-red-old-${n}`, null, deduct(RED, 180_000, 'transfer-with-owner', '2026-11-02', 'sale-older'));
    params.current = { workerId: farm.red, name: 'แดง' };
    wrap(<DebtAccountScreen />);
    await flush();
    const card = text('rp-card');
    const rows = within(card).getAllByTestId(/^rp-row-/).map((r) => r.props.testID);
    expect(rows).toEqual(['rp-row-sale-older-transfer', `rp-row-${SALE}-cash`]);
    expect(text('rp-card-total')).toHaveTextContent(/Σ รอเงินเข้ารวม.*฿ 5,050/);
  });

  it('picked from the worker\'s own pile: หยิบครบ ticks; "not picked" goes to the sale\'s payment page', async () => {
    // แดง's buyer-split line becomes a pick from his share on this sale.
    const evs = await financeStore.load();
    const line = evs.find((e) => e.targetId === `dp-red-${n}`)!;
    await writeFinance(`dp-red-${n}`, line.id, { t: 'debt_payment_changed', patch: { method: 'cash-from-share' } });
    params.current = { workerId: farm.red, name: 'แดง' };
    wrap(<DebtAccountScreen />);
    await flush();
    expect(text(`rp-row-${SALE}-picked`)).toHaveTextContent(/ยังไม่ได้หยิบจากส่วนแบ่งแดง/);
    await press(`rp-row-${SALE}-picked`);
    expect(text('rp-sheet')).toHaveTextContent(/หยิบเงินคืนหนี้จากส่วนแบ่งแดงแล้วหรือยัง/);
    await press('rp-sheet-picked-fix');
    expect(router.push).toHaveBeenCalledWith(`/v2/sale/${SALE}/payment?fix=${farm.red}&how=picked`);
    await press(`rp-row-${SALE}-picked`);
    await press('rp-sheet-picked-full');
    expect((await cashTick(farm.red)).done).toBe(true);
  });
});

describe('review fixes (E06-S08 independent review 2026-11-01)', () => {
  it('ticks in conflict on the sale → the sheet writes nothing and sends the owner to the payment page (D-30, PR-18)', async () => {
    const payee = `debt-cash-${farm.red}`;
    const target = paymentTarget(SALE, payee);
    // two phones: one says in full, one says 1,000 came (no base → two heads)
    const { financeStore: fs } = jest.requireMock('../store/finance') as { financeStore: { append: (e: unknown) => Promise<void> } };
    const mk = (id: string, device: string, received?: number) => ({ id, groupId: 'group-1', deviceSeq: 1, ts: 1, actor: { userId: 'u', deviceId: device }, source: 'app', targetId: target, baseEventId: null, payload: paymentMarkPayload(SALE, payee, true, 325_000, received) });
    await fs.append(mk(`c-a-${n}`, 'dev-a'));
    await fs.append(mk(`c-b-${n}`, 'dev-b', 100_000));
    params.current = { workerId: farm.red, name: 'แดง' };
    wrap(<DebtAccountScreen />);
    await flush();
    await press(`rp-row-${SALE}-cash`);
    expect(text('rp-sheet-locked')).toHaveTextContent('มีเรื่องต้องแก้ที่หน้าจ่ายเงินก่อน');
    expect(screen.queryByTestId('rp-sheet-full')).toBeNull();
    const before = (await financeStore.load()).length;
    await press('rp-sheet-open');
    expect(router.push).toHaveBeenCalledWith(`/v2/sale/${SALE}/payment`);
    expect((await financeStore.load()).length).toBe(before);
  });

  it('two quick taps on ได้ครบ write one tick (a ref guard, not state)', async () => {
    params.current = { workerId: farm.red, name: 'แดง' };
    wrap(<DebtAccountScreen />);
    await flush();
    await press(`rp-row-${SALE}-cash`);
    const btn = screen.getByTestId('rp-sheet-full');
    await act(async () => {
      fireEvent.press(btn);
      fireEvent.press(btn);
    });
    await flush();
    const ticks = (await financeStore.load()).filter((e) => e.payload.t === 'payment_mark_set');
    expect(ticks).toHaveLength(1);
  });
});
