import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { LogBuilder } from '../core/fixtures';
import { REPAY_ROUTES, ROUNDING_MENU, type RepayRoute } from '../core/finance/closeout';
import type { RoundingMode } from '../core/finance/deduct';
import { projectFinance } from '../core/finance/ledger';
import { FARM_FUNDS, type FinanceEvent } from '../core/finance/types';
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
import { clearClosing } from '../v2/sale/pieces';

/**
 * E05-S11 · "ไม่เปลี่ยน (ต้องมี test พิสูจน์)": every money rule the old
 * settlement / tally / payment pages proved (v2-sale-deduct, -money,
 * -netting tests, E06-S04 / E05-S05 / E05-S08), proved again on the new
 * close-out pages. Same sale as the story (28,875.00: แดง 9,187.50 · นัด
 * 5,250.00 · สวน 14,437.50). Both tappers owe the farm far more than any
 * share, so a sale here never changes the next one's proposal: แดง on a
 * 3,250 plan, นัด cut at his share. The farm owes นัด 640.
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
/** Two taps in the same tick: a write must land once (review #4). */
const doubleTap = async (id: string) => {
  await act(async () => {
    fireEvent.press(last(id));
    fireEvent.press(last(id));
  });
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
const disabled = (id: string) => !!last(id).props.accessibilityState?.disabled;

const FARM = { id: FARM_FUNDS, name: 'เงินสวน' };
let farm: MockFarm;

/** The story's sale: แดง 350 kg (7 full), นัด 200 kg (4 full) at 52.50 = 28,875.00. */
async function storySale(id: string, ts = Date.now()) {
  const b = new LogBuilder(id);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 5250, indexRef: '' });
  for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
  for (let n = 1; n <= 7; n++) b.acceptAt(farm.a[0], n);
  for (let n = 1; n <= 4; n++) b.acceptAt(farm.a[3], n);
  await seedSale(store(), b.build().map((e) => ({ ...e, ts })));
}

const inSale = async (saleId: string, ui: ReactElement) => {
  const r = wrap(<SaleProvider saleId={saleId}>{ui}</SaleProvider>);
  await flush();
  return r;
};

const all = () => financeStore.load();
const ofSale = (es: readonly FinanceEvent[], saleId: string) =>
  es.filter((e) => (e.payload.t === 'debt_payment_recorded' || e.payload.t === 'repayment_recorded') && e.payload.fields.saleId === saleId);
/** This sale's live debt payments for a worker: [method, satang], sorted. */
const live = async (saleId: string, worker: string) => {
  const es = await all();
  const gone = new Set(es.filter((e) => e.payload.t === 'debt_payment_changed' && e.payload.patch.deleted).map((e) => e.targetId));
  return es
    .flatMap((e) => (e.payload.t === 'debt_payment_recorded' && e.payload.fields.saleId === saleId && e.payload.fields.worker.id === worker && !gone.has(e.targetId) ? [[e.payload.fields.method, e.payload.fields.amountSatang] as const] : []))
    .sort();
};
const liveRepayments = async (saleId: string) => {
  const es = await all();
  const gone = new Set(es.filter((e) => e.payload.t === 'repayment_changed' && e.payload.patch.deleted).map((e) => e.targetId));
  return es.filter((e) => e.payload.t === 'repayment_recorded' && e.payload.fields.saleId === saleId && !gone.has(e.targetId));
};
const owedToNat = async () => projectFinance(await all()).reimbursements.filter((r) => r.to.id === farm.nat).reduce((a, r) => a + r.remainingSatang, 0);

/** Pass the summary's gates as the owner would: debt card ถูกต้อง, owed card ถูกต้อง (ไว้ก่อน). The cash step is not a gate (A3). */
async function gates(saleId: string) {
  await press('co-debt-open');
  await press('co-debt-ok');
  if (screen.queryAllByTestId('co-owed-open').length) {
    await press('co-owed-open');
    await press('co-owed-ok');
  } else await press('co-owed-none');
}
/** Summary → gates → ยืนยันยอด, in one go. */
async function confirmAs(saleId: string, before?: () => Promise<void>) {
  const r = await inSale(saleId, <CloseoutSummaryScreen />);
  if (before) await before();
  await gates(saleId);
  expect(last('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
  await press('co-confirm');
  r.unmount();
}

beforeAll(async () => {
  farm = await seedMockFarm(master());
  const RED = { id: farm.red, name: 'แดง' };
  const NAT = { id: farm.nat, name: 'นัด' };
  await writeFinance('d-red', null, { t: 'debt_added', fields: { worker: RED, kind: 'loan', amountSatang: 10_000_000, date: '2026-09-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
  await writeFinance('plan-red', null, { t: 'debt_plan_set', worker: RED, perSaleSatang: 325_000 });
  await writeFinance('d-nat', null, { t: 'debt_added', fields: { worker: NAT, kind: 'loan', amountSatang: 10_000_000, date: '2026-09-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
  await writeFinance('exp-nat', null, { t: 'expense_created', fields: { amountSatang: 64_000, date: '2026-10-25', stage: 'actual', categoryId: null, propertyId: null, item: 'ค่าปุ๋ย', note: '', payer: NAT } });
});

beforeEach(() => {
  globalThis.localStorage?.clear();
  router.push.mockClear();
  router.replace.mockClear();
});

describe('D-60 · the order is share → deduct debt → round → cash', () => {
  const S = 'r-order';
  beforeAll(() => storySale(S));
  beforeEach(() => clearDraft(S));

  it('cash is the share less the deduction, and only then rounded (first time: ให้คนกรีด)', async () => {
    await inSale(S, <CloseoutSummaryScreen />);
    // 9,187.50 − 3,250.00 = 5,937.50 → +0.50 → 5,938.00
    expect(last(`co-cash-${farm.red}`)).toHaveTextContent('5,938.00');
    await press(`co-deduct-${farm.red}`);
    await keys('1000');
    // 9,187.50 − 1,000.00 = 8,187.50 → +0.50 → 8,188.00: the rounding follows the deduction, not the share
    expect(last('co-res-cash')).toHaveTextContent(/8,188\.00$/);
    await press('co-deduct-ok');
    await press('co-sources-open');
    expect(last('co-src-debt')).toHaveTextContent(/แดง.*↘.*จ่ายหนี้.*−1,000\.00/);
    expect(last('co-src-rounding')).toHaveTextContent(/แดง.*\+0\.50/);
  });

  it('rounding to the owner rounds the cash after the deduction down', async () => {
    await act(async () => updateDraft(S, (d) => ({ ...d, rounding: 'owner' })));
    await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-cash-${farm.red}`)).toHaveTextContent('5,937.00');
  });
});

describe('D-18 · the deduction stays within the share (+ netting); cash never goes below 0', () => {
  const S = 'r-cap';
  beforeAll(() => storySale(S));
  beforeEach(() => clearDraft(S));

  it('above the share ตกลง is off and the cap is said; the share exactly leaves 0.00 cash', async () => {
    await inSale(S, <CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    await retype('5250.01');
    expect(disabled('co-deduct-ok')).toBe(true);
    expect(last('co-cap')).toHaveTextContent(/5,250\.00/);
    await press('co-quick-full');
    expect(disabled('co-deduct-ok')).toBe(false);
    expect(last('co-res-cash')).toHaveTextContent(/รับเงินสด0\.00$/);
  });

  // Netting is set through the draft here: how the owner enters it (whole or part) is the sheet's business, the cap is the rule.
  const netting = (nettingSatang: number, totalSatang: number) => act(async () => updateDraft(S, (d) => ({ ...d, workers: { [farm.nat]: { nettingSatang, totalSatang } } })));

  it('netting raises the cap to share + netting; cash is 0.00 at the cap, never below', async () => {
    await netting(64_000, 589_000);
    await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-cash-${farm.nat}`)).toHaveTextContent('0.00');
    expect(last(`co-net-${farm.nat}`)).toHaveTextContent(/\+640\.00/);
    await press(`co-deduct-${farm.nat}`);
    expect(last('co-res-cash')).toHaveTextContent(/รับเงินสด0\.00$/);
    await retype('5890.01');
    expect(disabled('co-deduct-ok')).toBe(true);
    expect(last('co-cap')).toHaveTextContent(/5,890\.00/);
    await retype('5890');
    expect(disabled('co-deduct-ok')).toBe(false);
  });

  it('part of what the farm owes can be netted: the cap is share + that part', async () => {
    await netting(40_000, 565_000);
    await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-cash-${farm.nat}`)).toHaveTextContent('0.00');
    await press(`co-deduct-${farm.nat}`);
    await retype('5650.01');
    expect(disabled('co-deduct-ok')).toBe(true);
    await retype('5650');
    expect(disabled('co-deduct-ok')).toBe(false);
  });

  it('the deduction cannot be less than the netting', async () => {
    await netting(64_000, 589_000);
    await inSale(S, <CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    await retype('500');
    expect(disabled('co-deduct-ok')).toBe(true);
    // its own words, not the cap's (review #8)
    expect(last('co-cap')).toHaveTextContent('ยอดหักต้องไม่น้อยกว่าหักกลบ 640');
    expect(last('co-cap')).not.toHaveTextContent(/หักได้ไม่เกิน/);
    await retype('640');
    expect(disabled('co-deduct-ok')).toBe(false);
    expect(last('co-res-cash')).toHaveTextContent(/5,250\.00$/);
  });

  it('netting more than the farm owes is refused: confirm stays off', async () => {
    await netting(64_001, 589_001);
    await inSale(S, <CloseoutSummaryScreen />);
    await gates(S);
    expect(disabled('co-confirm')).toBe(true);
    // N5 (re-review 2): the netting problem in the sheet's own words, not the cap's
    expect(last('co-confirm')).toHaveTextContent('หักกลบได้ไม่เกิน 640 · แก้ก่อน');
  });
});

describe('D-60 · netting only when the owner presses it', () => {
  const S = 'r-nonet';
  beforeAll(() => storySale(S));
  beforeEach(() => clearDraft(S));

  it('the farm owing นัด changes nothing by itself: the proposal has no netting, and confirm writes none', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-deduct-${farm.nat}`)).toHaveTextContent(/−5,250\.00/);
    expect(screen.queryByTestId(`co-net-${farm.nat}`)).toBeNull();
    r.unmount();
    await confirmAs(S);
    expect(await live(S, farm.nat)).toEqual([['transfer-with-owner', 525_000]]);
    expect(await liveRepayments(S)).toHaveLength(0);
    expect(await owedToNat()).toBe(64_000);
  });
});

describe('E06-S04 · netting on confirm, a route change, and taking the netting out', () => {
  const S = 'r-net';
  beforeAll(() => storySale(S));
  beforeEach(() => clearDraft(S));

  it('writes the netting (debt payment + repayment) and the difference by the route', async () => {
    await confirmAs(S, async () => {
      await act(async () => updateDraft(S, (d) => ({ ...d, workers: { [farm.nat]: { nettingSatang: 64_000, totalSatang: 589_000 } } })));
      await flush();
    });
    expect(await live(S, farm.nat)).toEqual([['netting', 64_000], ['transfer-with-owner', 525_000]]);
    const reps = await liveRepayments(S);
    expect(reps).toHaveLength(1);
    const net = (await all()).find((e) => e.payload.t === 'debt_payment_recorded' && e.payload.fields.method === 'netting' && e.payload.fields.saleId === S)!;
    expect(net.payload.t === 'debt_payment_recorded' && net.payload.fields.repaymentId).toBe(reps[0].targetId);
    expect(await owedToNat()).toBe(0);
  });

  it('a route change keeps the netting: the owed money is placed again, not lost', async () => {
    const c = await inSale(S, <CloseoutCashScreen />);
    expect(last(`cop-who-${farm.nat}`)).toHaveTextContent(/นัด\s*หัก 5,250\.00/);
    await press(`cop-route-${farm.nat}-cash-from-share`);
    await press('cop-ok');
    c.unmount();
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await gates(S);
    await press('co-confirm');
    r.unmount();
    expect(await live(S, farm.nat)).toEqual([['cash-from-share', 525_000], ['netting', 64_000]]);
    expect(await liveRepayments(S)).toHaveLength(1);
    expect(await owedToNat()).toBe(0);
  });

  it('taking the netting out voids its debt payment and its repayment; the farm owes นัด 640 again', async () => {
    const before = (await all()).filter((e) => e.payload.t === 'repayment_changed').length;
    await confirmAs(S, async () => {
      expect(last(`co-net-${farm.nat}`)).toHaveTextContent(/\+640\.00/);
      await act(async () => updateDraft(S, (d) => ({ ...d, workers: { [farm.nat]: { nettingSatang: 0, totalSatang: 525_000 } } })));
      await flush();
      expect(screen.queryByTestId(`co-net-${farm.nat}`)).toBeNull();
    });
    expect(await live(S, farm.nat)).toEqual([['cash-from-share', 525_000]]);
    expect(await liveRepayments(S)).toHaveLength(0);
    expect((await all()).filter((e) => e.payload.t === 'repayment_changed').length).toBe(before + 1);
    expect(await owedToNat()).toBe(64_000);
  });
});

describe('editing what was confirmed replaces it; an unchanged confirm writes nothing', () => {
  const S = 'r-edit';
  beforeAll(() => storySale(S));
  beforeEach(() => clearDraft(S));

  it('two taps on ยืนยันยอด write once', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await gates(S);
    await doubleTap('co-confirm');
    r.unmount();
    expect(ofSale(await all(), S).filter((e) => e.payload.t === 'debt_payment_recorded')).toHaveLength(2);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('the page reopens with what was saved, not a second instalment; confirming it again writes nothing', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-deduct-${farm.red}`)).toHaveTextContent(/−3,250\.00/);
    r.unmount();
    const n = (await all()).length;
    await confirmAs(S);
    expect((await all()).length).toBe(n);
  });

  it('a changed amount replaces the saved line', async () => {
    await confirmAs(S, async () => {
      await press(`co-deduct-${farm.red}`);
      await keys('1500');
      await press('co-deduct-ok');
    });
    expect(await live(S, farm.red)).toEqual([['transfer-with-owner', 150_000]]);
    expect(await live(S, farm.nat)).toEqual([['transfer-with-owner', 525_000]]);
  });
});

describe('an older sale writes the sale day, not today', () => {
  const S = 'r-old';
  const DAY = '2026-10-03';
  beforeAll(() => storySale(S, Date.parse(`${DAY}T08:00:00`)));

  it('every line and the rounding carry the sale', async () => {
    await confirmAs(S);
    const mine = (await all()).flatMap((e) => (e.payload.t === 'debt_payment_recorded' && e.payload.fields.saleId === S ? [e.payload.fields.date] : []));
    expect(mine).toEqual([DAY, DAY]);
    expect((await all()).some((e) => e.payload.t === 'sale_rounding_set' && e.payload.saleId === S)).toBe(true);
  });
});

describe('CO-24 · "ต้องแตกเงิน" follows needsChange, even when no single break plan exists (review #7)', () => {
  const S = 'r-break';
  beforeAll(() => storySale(S));

  it('share 9,187.50, ไม่ปัด, หยิบจากเงินแดง 3,250.25: the chip shows and its sheet says change is needed in a plain line', async () => {
    await act(async () => updateDraft(S, (d) => ({ ...d, rounding: 'none', workers: { [farm.red]: { totalSatang: 325_025, route: 'cash-from-share' } } })));
    await inSale(S, <CloseoutCashScreen />);
    expect(last(`cop-break-${farm.red}`)).toHaveTextContent(/ต้องแตกเงิน/);
    await press(`cop-break-${farm.red}`);
    expect(last('cop-break-sheet')).toHaveTextContent(/เงินของแดง ฿ 9,187\.50/);
    expect(last('cop-break-plain')).toHaveTextContent(/ขอเงินทอนจากคนรับซื้อยาง/);
    expect(screen.queryByTestId('cop-break-into')).toBeNull();
    await act(async () => clearDraft(S));
  });
});

describe('an older sale whose deduction came by two routes says saving merges them (review #9, old v2s.mergeRoutes)', () => {
  const S = 'r-mixed';
  beforeAll(async () => {
    await storySale(S);
    const RED = { id: farm.red, name: 'แดง' };
    await writeFinance('mix-1', null, { t: 'debt_payment_recorded', fields: { worker: RED, creditor: FARM, amountSatang: 100_000, date: '2026-10-14', note: '', method: 'transfer-with-owner', saleId: S } });
    await writeFinance('mix-2', null, { t: 'debt_payment_recorded', fields: { worker: RED, creditor: FARM, amountSatang: 225_000, date: '2026-10-14', note: '', method: 'buyer-split', saleId: S } });
  });

  it('the deduct sheet and the cash step warn for that tapper only; confirm then puts it on the one route chosen', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.red}`);
    expect(last('co-merge-warn')).toHaveTextContent(/การหักเดิมรับคืนหลายทาง บันทึกแล้วจะรวมเป็นทางที่เลือกทางเดียว/);
    await press('co-deduct-sheet-close');
    await press(`co-deduct-${farm.nat}`);
    expect(screen.queryByTestId('co-merge-warn')).toBeNull();
    await press('co-deduct-sheet-close');
    r.unmount();
    const c = await inSale(S, <CloseoutCashScreen />);
    expect(last(`cop-merge-${farm.red}`)).toHaveTextContent(/รวมเป็นทางที่เลือกทางเดียว/);
    expect(screen.queryByTestId(`cop-merge-${farm.nat}`)).toBeNull();
    c.unmount();
    await confirmAs(S);
    expect(await live(S, farm.red)).toEqual([['transfer-with-owner', 325_000]]);
  });
});

describe('a stale check asks again (review #10): a balance or this sale\'s lines changed after the owner checked', () => {
  const S = 'r-stale';
  beforeAll(() => storySale(S));

  it('จดหนี้เพิ่ม for แดง drops only แดง\'s debt check; a new bill the farm owes นัด drops the owed check', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await gates(S);
    expect(last('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
    r.unmount();
    // another device synced (or the owner went to จดหนี้เพิ่ม and came back)
    const d = await writeFinance('stale-debt', null, { t: 'debt_added', fields: { worker: { id: farm.red, name: 'แดง' }, kind: 'loan', amountSatang: 50_000, date: '2026-10-20', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
    const r2 = await inSale(S, <CloseoutSummaryScreen />);
    expect(last('co-confirm')).toHaveTextContent('↑ ตรวจหนี้ของแดงก่อน');
    expect(last('co-debt-badge')).toHaveTextContent('1');
    await press('co-debt-open');
    await press('co-debt-ok');
    expect(last('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
    r2.unmount();
    const x = await writeFinance('stale-exp', null, { t: 'expense_created', fields: { amountSatang: 10_000, date: '2026-10-26', stage: 'actual', categoryId: null, propertyId: null, item: 'ค่าน้ำมัน', note: '', payer: { id: farm.nat, name: 'นัด' } } });
    await inSale(S, <CloseoutSummaryScreen />);
    expect(last('co-confirm')).toHaveTextContent('↑ ตรวจการ์ดสวนค้างจ่ายก่อน');
    await act(async () => clearDraft(S));
    // the shared fixture as it was, for the tests after this one
    await writeFinance('stale-debt', d.id, { t: 'debt_changed', patch: { deleted: true } });
    await writeFinance('stale-exp', x.id, { t: 'expense_changed', patch: { deleted: true } });
  });
});

describe('a confirm that fails is said, never silent (review #6)', () => {
  const S = 'r-fail';
  beforeAll(() => storySale(S));

  it('a write that throws: an error banner, no payment page, the lines re-read; pressing again finishes without writing twice', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await gates(S);
    router.push.mockClear();
    let calls = 0;
    const real = financeStore.append.bind(financeStore);
    const spy = jest.spyOn(financeStore, 'append').mockImplementation(async (e) => {
      // the first write (แดง) lands, the second (นัด) fails
      calls += 1;
      if (calls === 2) throw new Error('disk full');
      return real(e);
    });
    await press('co-confirm');
    spy.mockRestore();
    expect(last('co-confirm-error')).toHaveTextContent(/บันทึกไม่สำเร็จ/);
    expect(router.push).not.toHaveBeenCalled();
    expect(await live(S, farm.red)).toEqual([['transfer-with-owner', 325_000]]);
    expect(await live(S, farm.nat)).toEqual([]);
    await press('co-confirm');
    expect(screen.queryByTestId('co-confirm-error')).toBeNull();
    expect(router.push).toHaveBeenCalledWith(`/v2/sale/${S}/payment`);
    expect(await live(S, farm.red)).toEqual([['transfer-with-owner', 325_000]]);
    expect(await live(S, farm.nat)).toEqual([['transfer-with-owner', 525_000]]);
    r.unmount();
  });
});

describe('offline · a confirm stopped part-way, then pressed again, writes nothing twice', () => {
  const S = 'r-stop';
  beforeAll(() => storySale(S));

  it('the tapper written before the stop stays; the second press writes only the other', async () => {
    const append = financeStore.append.bind(financeStore);
    let seen = 0;
    const spy = jest.spyOn(financeStore, 'append').mockImplementation(async (e: FinanceEvent) => {
      if (e.payload.t === 'debt_payment_recorded' && ++seen === 2) throw new Error('app closed');
      return append(e);
    });
    try {
      await inSale(S, <CloseoutSummaryScreen />);
      await gates(S);
      await act(async () => {
        try {
          await (fireEvent.press(last('co-confirm')) as unknown as Promise<void>);
        } catch {
          // the stop
        }
      });
      await flush();
      const after1 = ofSale(await all(), S);
      expect(after1).toHaveLength(1);
      expect(router.push).not.toHaveBeenCalled();
      // the draft is still there: the button is still ready
      expect(last('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
      await press('co-confirm');
    } finally {
      spy.mockRestore();
    }
    const lines = ofSale(await all(), S);
    expect(lines).toHaveLength(2);
    expect(new Set(lines.map((e) => e.targetId)).size).toBe(2);
    expect(await live(S, farm.red)).toEqual([['transfer-with-owner', 325_000]]);
    expect(await live(S, farm.nat)).toEqual([['transfer-with-owner', 525_000]]);
    expect(router.push).toHaveBeenCalledWith(`/v2/sale/${S}/payment`);
  });
});

describe('offline · the app closed part-way through a confirm, then reopened', () => {
  const S = 'r-reopen';
  beforeAll(() => storySale(S));

  it('the tapper written stays written; the other is the proposal again, and confirming writes only him', async () => {
    const append = financeStore.append.bind(financeStore);
    let seen = 0;
    const spy = jest.spyOn(financeStore, 'append').mockImplementation(async (e: FinanceEvent) => {
      if (e.payload.t === 'debt_payment_recorded' && ++seen === 2) throw new Error('app closed');
      return append(e);
    });
    try {
      const r = await inSale(S, <CloseoutSummaryScreen />);
      await gates(S);
      await act(async () => {
        try {
          await (fireEvent.press(last('co-confirm')) as unknown as Promise<void>);
        } catch {
          // the stop
        }
      });
      r.unmount();
    } finally {
      spy.mockRestore();
    }
    // The draft lives in memory only: the app closing loses it.
    clearDraft(S);
    expect(ofSale(await all(), S)).toHaveLength(1);
    await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-deduct-${farm.red}`)).toHaveTextContent(/−3,250\.00/);
    expect(last(`co-deduct-${farm.nat}`)).toHaveTextContent(/−5,250\.00/);
    await gates(S);
    await press('co-confirm');
    const lines = ofSale(await all(), S);
    expect(lines).toHaveLength(2);
    expect(await live(S, farm.red)).toEqual([['transfer-with-owner', 325_000]]);
    expect(await live(S, farm.nat)).toEqual([['transfer-with-owner', 525_000]]);
  });
});

describe('D-71 · all three repay routes give the same money; Σ every pile = the sale to the satang', () => {
  const S = 'r-routes';
  beforeAll(() => storySale(S));
  beforeEach(() => clearDraft(S));

  const cases: [RepayRoute, RoundingMode][] = REPAY_ROUTES.flatMap((r) => ROUNDING_MENU.map((m) => [r, m] as [RepayRoute, RoundingMode]));
  it.each(cases)('route %s, rounding %s: the tally bar is green, the buyer pays 28,875.00, the tapper the same cash', async (route, rounding) => {
    await act(async () =>
      updateDraft(S, (d) => ({ ...d, rounding, workers: { [farm.red]: { route }, [farm.nat]: { route, nettingSatang: 64_000, totalSatang: 589_000 } } })),
    );
    const s = await inSale(S, <CloseoutSummaryScreen />);
    const cash = { worker: '5,938.00', none: '5,937.50', owner: '5,937.00' }[rounding];
    expect(last(`co-cash-${farm.red}`)).toHaveTextContent(cash);
    expect(last(`co-cash-${farm.nat}`)).toHaveTextContent('0.00');
    expect(last('co-tally')).toHaveTextContent(/ตรงถึงสตางค์/);
    await press('co-sources-open');
    for (const box of ['co-src-shares', 'co-src-debt', 'co-src-rounding', 'co-src-paid']) expect(last(box)).not.toHaveTextContent(/ไม่ตรง/);
    s.unmount();
    await inSale(S, <CloseoutCashScreen />);
    expect(last('cop-total')).toHaveTextContent(/28,875\.00/);
    expect(screen.queryByTestId('cop-off')).toBeNull();
  });

  it.each(REPAY_ROUTES)('confirmed by %s, the payment page adds up and can close', async (route) => {
    const id = `r-route-${route}`;
    await storySale(id);
    await confirmAs(id, async () => {
      await act(async () => updateDraft(id, (d) => ({ ...d, workers: { [farm.red]: { route }, [farm.nat]: { route } } })));
      await flush();
    });
    expect(await live(id, farm.red)).toEqual([[route, 325_000]]);
    await inSale(id, <CloseoutPayScreen />);
    expect(last('pay-tally')).toHaveTextContent(/ยอดตรงกันแล้ว/);
    expect(last(`tick-amt-${farm.red}`)).toHaveTextContent('5,938.00');
    expect(disabled('close-sale')).toBe(false);
  });
});

describe('D-61 · deducted over the share (the sale edited down after): ticks and close locked until the summary fixes it', () => {
  const S = 'r-over';
  beforeAll(async () => {
    await storySale(S);
    await writeFinance('pay-over', null, {
      t: 'debt_payment_recorded',
      fields: { worker: { id: farm.red, name: 'แดง' }, creditor: FARM, amountSatang: 950_000, date: '2026-10-14', note: '', method: 'cash-from-share', saleId: S },
    });
    await writeFinance(`sale-rounding-${S}`, null, { t: 'sale_rounding_set', saleId: S, mode: 'worker' });
  });

  it('the payment page locks his tick, the cash repayment tick, the owner\'s tick and the close', async () => {
    const r = await inSale(S, <CloseoutPayScreen />);
    expect(screen.getByTestId('pay-over')).toBeTruthy();
    expect(last('tick-owner').props.accessibilityState).toMatchObject({ disabled: true });
    expect(last(`tick-debt-cash-${farm.red}`).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByTestId(`tick-${farm.red}`) ? last(`tick-${farm.red}`).props.accessibilityState : { disabled: true }).toMatchObject({ disabled: true });
    expect(disabled('close-sale')).toBe(true);
    r.unmount();
  });

  it('the summary is not a dead end: the draft starts at the recorded 9,500 (above the cap), fixing it in the deduct sheet lets confirm write, and the payment page unlocks', async () => {
    clearDraft(S);
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await gates(S);
    // Above the cap → the sheet's own "invalid" gate, never a lock the summary cannot lift.
    expect(disabled('co-confirm')).toBe(true);
    expect(last('co-confirm')).toHaveTextContent('ยอดหักเกินที่หักได้ · แก้ก่อน');
    await press('co-sources-open');
    expect(last('co-src-debt')).toHaveTextContent(/ไม่ตรง/);
    await press('co-sources-sheet-close');
    await press(`co-deduct-${farm.red}`);
    expect(disabled('co-deduct-ok')).toBe(true);
    await retype('3250');
    expect(disabled('co-deduct-ok')).toBe(false);
    await press('co-deduct-ok');
    expect(disabled('co-confirm')).toBe(false);
    await press('co-confirm');
    r.unmount();
    expect(await live(S, farm.red)).toEqual([['cash-from-share', 325_000]]);
    await inSale(S, <CloseoutPayScreen />);
    expect(screen.queryByTestId('pay-over')).toBeNull();
    expect(last('pay-tally')).toHaveTextContent(/ยอดตรงกันแล้ว/);
    expect(disabled('close-sale')).toBe(false);
    expect(last(`tick-${farm.red}`).props.accessibilityState).toMatchObject({ disabled: false });
  });
});

describe('close stays off when the piles do not add up (re-review N5)', () => {
  const S = 'r-stray';
  beforeAll(async () => {
    await storySale(S);
    await writeFinance(`sale-rounding-${S}`, null, { t: 'sale_rounding_set', saleId: S, mode: 'worker' });
  });

  it('close is on while they add up, off once a stray repayment rides on the transfer', async () => {
    const r = await inSale(S, <CloseoutPayScreen />);
    expect(disabled('close-sale')).toBe(false);
    r.unmount();
    // A repayment "with the owner's transfer" by someone with no share in this sale:
    // it raises the transfer but not the sale, so the piles no longer add up.
    await writeFinance('dpay-stray', null, {
      t: 'debt_payment_recorded',
      fields: { worker: { id: 'stranger', name: 'x' }, creditor: FARM, amountSatang: 10_000, date: '2026-10-03', note: '', method: 'transfer-with-owner', saleId: S },
    });
    await inSale(S, <CloseoutPayScreen />);
    expect(last('pay-tally')).not.toHaveTextContent(/ยอดตรงกันแล้ว/);
    expect(disabled('close-sale')).toBe(true);
  });
});

describe('a closed sale is read-only (review #2), but its ticks stay open (owner, option ก)', () => {
  const S = 'r-closed';
  beforeAll(async () => {
    await storySale(S);
    await confirmAs(S);
  });

  it('close completes the sale; a double tap on a tick writes once', async () => {
    await inSale(S, <CloseoutPayScreen />);
    await doubleTap(`tick-${farm.red}`);
    expect((await all()).filter((e) => e.payload.t === 'payment_mark_set' && e.payload.saleId === S)).toHaveLength(1);
    await press('close-sale');
    const ev = await store().load(S);
    expect(ev.some((e) => e.kind === 'sys' && e.payload.t === 'sale_status_set' && e.payload.status === 'completed')).toBe(true);
    clearClosing();
  });

  it('the summary of a closed sale goes to its payment and writes no deduction', async () => {
    const n = (await all()).length;
    await inSale(S, <CloseoutSummaryScreen />);
    expect(router.replace).toHaveBeenCalledWith(`/v2/sale/${S}/payment`);
    expect(disabled('co-confirm')).toBe(true);
    await press(`co-deduct-${farm.red}`);
    if (screen.queryAllByTestId('co-deduct-sheet').length) {
      await retype('100');
      await press('co-deduct-ok');
    }
    await gates(S);
    await press('co-confirm');
    expect((await all()).length).toBe(n);
  });

  it('after close the ticks still tick, untick and tick again; the sale stays closed', async () => {
    await inSale(S, <CloseoutPayScreen />);
    expect(screen.queryByTestId('close-sale')).toBeNull();
    await press(`tick-${farm.red}`);
    expect(last(`tick-${farm.red}`).props.accessibilityState).toMatchObject({ checked: false });
    await press(`tick-${farm.red}`);
    expect(last(`tick-${farm.red}`).props.accessibilityState).toMatchObject({ checked: true });
    const ev = await store().load(S);
    expect(ev.filter((e) => e.kind === 'sys' && e.payload.t === 'sale_status_set')).toHaveLength(1);
  });
});

describe('E05-S08 · the sale in detail, edge cases (was the tally page)', () => {
  it('a voided basket is not in the weight, the baskets or the amounts', async () => {
    const S = 'r-void';
    const b = new LogBuilder(S);
    b.sys({ t: 'sale_started', farmName: '', buyer: 'x', manager: '', workerLead: '', where: 'farm' });
    b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
    b.sys({ t: 'pile_added', pileId: farm.a[0], zoneId: farm.farmA, name: 'p', tareG: 2_000, stdNetG: 50_000 });
    b.acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 2);
    const target = b.nextId();
    b.acceptAt(farm.a[0], 3);
    b.void(farm.a[0], target);
    await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
    await inSale(S, <CloseoutSummaryScreen />);
    expect(last('co-sale-strip')).toHaveTextContent(/4,850\.00/);
    await press('co-sale-open');
    expect(last('co-sale-sheet')).toHaveTextContent(/100 กก\./);
    expect(last('co-sale-sheet')).toHaveTextContent(/2 เข่ง/);
    expect(last('co-tally')).toHaveTextContent(/ตรงถึงสตางค์/);
  });

  it('a sale with no baskets yet: no tapper cards, nothing to add up, no crash', async () => {
    const S = 'r-empty';
    const b = new LogBuilder(S);
    b.sys({ t: 'sale_started', farmName: '', buyer: 'x', manager: '', workerLead: '', where: 'farm' });
    b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
    await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
    await inSale(S, <CloseoutSummaryScreen />);
    expect(screen.queryByTestId(`co-worker-${farm.red}`)).toBeNull();
    expect(last('co-sale-strip')).toHaveTextContent(/0\.00/);
  });
});
