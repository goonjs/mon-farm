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
import { clearDraft } from '../v2/sale/closeout/use-closeout';
import { CloseoutSummaryScreen } from '../v2/sale/closeout/summary-screen';

/** The traced originals drawn inside the element with this testID (E03-S11). */

// Each case renders whole close-out screens and writes to the finance log: 1–2 s here, 3–4× slower on
// a CI runner, where jest's 5 s default timed out a first case and the shared fixture failed the rest.
jest.setTimeout(20_000);

/**
 * E06-S09 PR-b · the deduct sheet with instalment plans (mockup band ข/ง แบบ A · IP-9…IP-15), on the
 * close-out example: นัด ส่วนแบ่ง 5,250.00, หนี้ 8,350 (no plan yet) · แดง ผ่อนงวดละ 3,250 (old per-sale plan).
 * The cases run in order on one log: a plan picked and confirmed, then the same sale re-opened on the plan.
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
const router = () => (jest.requireMock('expo-router') as { router: { push: jest.Mock } }).router;

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
const keys = async (digits: string) => {
  for (const d of digits) await press(`co-pad-key-${d}`);
};
const text = (id: string) => screen.getByTestId(id);
const disabled = (id: string) => !!screen.getByTestId(id).props.accessibilityState?.disabled;

const SALE = 'sale-co';
const inSale = async (ui: ReactElement) => {
  const r = wrap(<SaleProvider saleId={SALE}>{ui}</SaleProvider>);
  await flush();
  return r;
};
const FARM = { id: FARM_FUNDS, name: 'เงินสวน' };
const all = async () => financeStore.load();

let farm: MockFarm;

beforeAll(async () => {
  farm = await seedMockFarm(master());
  const b = new LogBuilder(SALE);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 5250, indexRef: '' });
  for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
  // แดง 350 กก. (7 เข่ง) · นัด 200 กก. (4 เข่ง) at 52.50 = 28,875.00
  for (let n = 1; n <= 7; n++) b.acceptAt(farm.a[0], n);
  for (let n = 1; n <= 4; n++) b.acceptAt(farm.a[3], n);
  await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
  const RED = { id: farm.red, name: 'แดง' };
  const NAT = { id: farm.nat, name: 'นัด' };
  const loan = (worker: typeof RED, amountSatang: number, date: string) => ({ t: 'debt_added' as const, fields: { worker, kind: 'loan' as const, amountSatang, date, note: '', lender: FARM, fertilizer: null, carriedForward: false } });
  const fert = (worker: typeof RED, amountSatang: number, date: string) => ({
    t: 'debt_added' as const,
    fields: { worker, kind: 'fertilizer' as const, amountSatang, date, note: '', lender: null, fertilizer: { totalSatang: amountSatang * 2, workerPct: 50 }, carriedForward: false },
  });
  await writeFinance('d-red-1', null, loan(RED, 600_000, '2026-09-01'));
  await writeFinance('d-red-2', null, fert(RED, 579_000, '2026-09-28'));
  await writeFinance('d-red-3', null, fert(RED, 400_000, '2026-10-05'));
  await writeFinance('plan-red', null, { t: 'debt_plan_set', worker: RED, perSaleSatang: 325_000 });
  await writeFinance('d-nat-1', null, fert(NAT, 735_000, '2026-10-05'));
  await writeFinance('d-nat-2', null, loan(NAT, 100_000, '2026-10-20'));
  // the farm owes นัด 640 (นัด paid a fertilizer bill for the farm)
  await writeFinance('exp-nat', null, { t: 'expense_created', fields: { amountSatang: 64_000, date: '2026-10-25', stage: 'actual', categoryId: null, propertyId: null, item: 'ค่าปุ๋ย', note: '', payer: NAT } });
});

beforeEach(() => {
  clearDraft(SALE);
  router().push.mockClear();
});

const plans = async () => (await all()).filter((e) => e.payload.t === 'debt_plan_set' && e.targetId === `plan-${farm.nat}`);
const checkAll = async () => {
  await press('co-debt-open');
  await press('co-debt-ok');
  await press('co-owed-open');
  await press('co-owed-ok');
};

describe('IP-9 / IP-10 · no plan yet: "ผ่อนกี่งวด" on the pad sheet, the plan written at ยืนยันยอด only', () => {
  it('offers 2, 3, 4 with their instalment; 3 → 2,784 now, "งวด 1 จาก 3 · งวดต่อไปราว 2,783"', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    expect(screen.queryByTestId('co-quick-half')).toBeNull();
    expect(text('co-inst-pick-2')).toHaveTextContent(/2 งวด.*งวดละ 4,175/);
    expect(text('co-inst-pick-3')).toHaveTextContent(/3 งวด.*งวดละ 2,784/);
    expect(text('co-inst-pick-4')).toHaveTextContent(/4 งวด.*งวดละ 2,088/);
    expect(screen.queryByTestId('co-inst-pick-5')).toBeNull();
    await press('co-inst-pick-3');
    expect(text('co-amount')).toHaveTextContent(/2,784/);
    expect(text('co-inst-first')).toHaveTextContent('งวด 1 จาก 3 · งวดต่อไปราว 2,783');
    expect(text('co-inst-pick-3').props.accessibilityState).toMatchObject({ selected: true });
    // หักเต็ม is an amount, not the count picked a moment ago
    await press('co-quick-full');
    expect(screen.queryByTestId('co-inst-first')).toBeNull();
  });

  it('✓ → the row says "ผ่อนงวด 1/3"; ยืนยันยอด writes the plan with the lines, from this sale', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    await press('co-inst-pick-3');
    await press('co-deduct-ok');
    expect(text(`co-deduct-${farm.nat}`)).toHaveTextContent(/หักหนี้ · ผ่อนงวด 1\/3.*−2,784\.00/);
    expect(await plans()).toHaveLength(0);
    await checkAll();
    await press('co-confirm');
    const written = await plans();
    expect(written).toHaveLength(1);
    expect(written[0].payload).toMatchObject({ perSaleSatang: 278_400, installments: { count: 3, fromSaleId: SALE, owedSatang: 835_000 } });
    const lines = (await all()).filter((e) => e.payload.t === 'debt_payment_recorded' && (e.payload as { fields: { worker: { id: string } } }).fields.worker.id === farm.nat);
    expect(lines.map((e) => (e.payload as { fields: { amountSatang: number } }).fields.amountSatang)).toEqual([278_400]);
    // Lead (PR-c): the plan lands BEFORE the lines — an app killed in between leaves a plan whose sale has no
    // line yet (not counted; pressing confirm again proposes the same instalment), never lines without their plan.
    const log = await all();
    expect(log.indexOf(written[0])).toBeLessThan(log.indexOf(lines[0]));
  });
});

describe('IP-11 / IP-14 · a running plan opens on the plan view', () => {
  it('boxes, the one answer and one button; "ทำอย่างอื่น" rows with ›; no close-all when the share cannot', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    expect(text('co-inst-sub')).toHaveTextContent('ผ่อน 3 งวด · วันนี้งวด 1');
    expect(text('co-inst-now')).toHaveTextContent(/งวด 1.*2,784.*วันนี้/);
    expect(text('co-inst-next-2')).toHaveTextContent(/งวด 2.*2,783/);
    expect(text('co-inst-next-3')).toHaveTextContent(/งวด 3.*2,783.*สุดท้าย/);
    expect(text('co-inst-big')).toHaveTextContent(/หักตามงวด · งวด 1 จาก 3.*2,784.*นัดรับเงินสด 2,466\.00 · หนี้เหลือ 5,566\.00/);
    expect(text('co-deduct-ok')).toHaveTextContent('หักงวด 1 · 2,784');
    expect(screen.queryByTestId('co-pad')).toBeNull();
    expect(screen.queryByTestId('co-inst-row-all')).toBeNull();
    for (const id of ['co-inst-row-resplit', 'co-inst-row-typed', 'co-inst-row-none']) expect(text(id)).toBeTruthy();
  });

  it('แบ่งงวดที่เหลือใหม่: no count until one is picked; 4 → 2,088 "แบ่ง 4 งวด"; ‹ back → the plan again', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    await press('co-inst-row-resplit');
    expect(disabled('co-deduct-ok')).toBe(true);
    expect(screen.queryByTestId('co-inst-split-3')).toBeNull();
    expect(text('co-inst-split-2')).toHaveTextContent(/2 งวด.*งวดละ 4,175/);
    await press('co-inst-split-4');
    expect(text('co-deduct-ok')).toHaveTextContent('แบ่ง 4 งวด · หัก 2,088');
    expect(text('co-inst-big')).toHaveTextContent(/หักวันนี้ · งวด 1 จาก 4/);
    await press('co-inst-back');
    expect(text('co-deduct-ok')).toHaveTextContent('หักงวด 1 · 2,784');
  });

  it('ใส่ยอดเอง: the pad with the boxes and the back link; the typed amount is this instalment', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    await press('co-inst-row-typed');
    expect(text('co-inst-sub')).toHaveTextContent('ใส่ยอดเอง · ผ่อน 3 งวด วันนี้งวด 1');
    await keys('3000');
    expect(text('co-inst-now')).toHaveTextContent(/3,000/);
    expect(text('co-deduct-ok')).toHaveTextContent('หัก 3,000');
    expect(text('co-inst-back')).toBeTruthy();
  });

  it('ยังไม่หัก · ขอติดไว้ก่อน: 0, checked, the sheet closes in one tap', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    await press('co-inst-row-none');
    expect(screen.queryByTestId('co-deduct-sheet')).toBeNull();
    expect(text(`co-deduct-${farm.nat}`)).toHaveTextContent(/หักหนี้ · เก่าก่อน0\.00$/);
  });
});

describe('IP-13 · new debt since the plan: no default, confirm gated until fold / in full', () => {
  it('a 1,000 debt added → the amber band, the button grey; fold → 3,117, in full → 3,784; the page gate names นัด', async () => {
    await writeFinance('d-nat-3', null, { t: 'debt_added', fields: { worker: { id: farm.nat, name: 'นัด' }, kind: 'loan', amountSatang: 100_000, date: '2026-11-05', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
    await inSale(<CloseoutSummaryScreen />);
    await checkAll();
    expect(text('co-confirm')).toHaveTextContent('↑ เลือกวิธีจัดการหนี้ใหม่ของนัดก่อน');
    await press(`co-deduct-${farm.nat}`);
    expect(text('co-inst-newdebt')).toHaveTextContent(/หนี้ใหม่ \+1,000\.00/);
    expect(disabled('co-deduct-ok')).toBe(true);
    expect(text('co-deduct-ok')).toHaveTextContent('เลือกวิธีจัดการหนี้ใหม่ก่อน');
    await press('co-inst-fold');
    expect(text('co-deduct-ok')).toHaveTextContent('หักงวด 1 · 3,117');
    await press('co-inst-full');
    expect(text('co-deduct-ok')).toHaveTextContent('หักงวด 1 · 3,784');
    await press('co-deduct-ok');
    expect(text('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
  });
});
