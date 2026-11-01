import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { LogBuilder } from '../core/fixtures';
import { projectFinance } from '../core/finance/ledger';
import { FARM_FUNDS, type FinanceEvent, type FinancePayload } from '../core/finance/types';
import { uuidv7 } from '../lib/id';
import { financeStore } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { CloseoutPayScreen } from '../v2/sale/closeout/pay-screen';
import { CloseoutSummaryScreen } from '../v2/sale/closeout/summary-screen';
import { clearDraft, updateDraft } from '../v2/sale/closeout/use-closeout';

// Each case renders whole close-out screens and writes to the finance log: 1–2 s here, 3–4× slower on
// a CI runner, where jest's 5 s default timed out a first case and the shared fixture failed the rest.
jest.setTimeout(20_000);

/**
 * E05-S11 re-review 2 (B1, N2, N3, N5) on the real pages. Owner 2026-11-01
 * (A): two phones confirming the same sale offline both count — the
 * double deduction shows on the summary (flag on the card, confirm off until
 * the owner sets the amount) and locks the payment page like D-61, even when
 * the sum stays inside the share. The other phone's lines are appended as
 * events from another device id, the way a sync lands them. Same story sale
 * and fixture as v2-closeout-rules (own log: the other phone's lines must not
 * reach those tests).
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
const mockFocused = new Set<() => void>();
jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => true), dismissAll: jest.fn(), dismissTo: jest.fn() };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    // Review 4: kept so a test can land a sync while a page stays open (its finance reader reloads on focus).
    useFocusEffect: (cb: () => void) => void mockFocused.add(cb),
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


/** A line the OTHER phone wrote (its own device id), landing by sync. */
async function fromPhoneB(targetId: string, payload: FinancePayload, base: string | null = null): Promise<FinanceEvent> {
  const any = (await all())[0];
  const e: FinanceEvent = { id: uuidv7(), groupId: any.groupId, deviceSeq: 1 + (await all()).filter((x) => x.actor.deviceId === 'phone-B').length, ts: Date.now(), actor: { userId: any.actor.userId, deviceId: 'phone-B' }, source: 'app', targetId, baseEventId: base, payload };
  await financeStore.append(e);
  return e;
}
const RED = () => ({ id: farm.red, name: 'แดง' });
const NAT = () => ({ id: farm.nat, name: 'นัด' });
const phoneBDeducts = (saleId: string, worker: { id: string; name: string }, amountSatang: number, method: 'transfer-with-owner' | 'netting' = 'transfer-with-owner', repaymentId?: string) =>
  fromPhoneB(`dpay-B-${uuidv7()}`, { t: 'debt_payment_recorded', fields: { worker, creditor: FARM, amountSatang, date: '2026-10-31', note: '', method, saleId, ...(repaymentId ? { repaymentId } : {}) } });

beforeAll(async () => {
  farm = await seedMockFarm(master());
  await writeFinance('d-red', null, { t: 'debt_added', fields: { worker: RED(), kind: 'loan', amountSatang: 10_000_000, date: '2026-09-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
  await writeFinance('plan-red', null, { t: 'debt_plan_set', worker: RED(), perSaleSatang: 325_000 });
  await writeFinance('d-nat', null, { t: 'debt_added', fields: { worker: NAT(), kind: 'loan', amountSatang: 10_000_000, date: '2026-09-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
  await writeFinance('exp-nat', null, { t: 'expense_created', fields: { amountSatang: 64_000, date: '2026-10-25', stage: 'actual', categoryId: null, propertyId: null, item: 'ค่าปุ๋ย', note: '', payer: NAT() } });
});

beforeEach(() => {
  globalThis.localStorage?.clear();
  router.push.mockClear();
  router.replace.mockClear();
});

describe('N2 · the debt deleted after the deduction: the ↘ row stays so the owner can set 0, and the payment page is locked meanwhile', () => {
  const S = 'd-gone';
  let gone: FinanceEvent;
  beforeAll(async () => {
    await storySale(S);
    await writeFinance('d-small', null, { t: 'debt_added', fields: { worker: RED(), kind: 'other', amountSatang: 100_000, date: '2026-10-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
  });
  afterAll(async () => {
    // the shared fixture as it was
    const es = await all();
    const head = es.filter((e) => e.targetId === 'd-red').pop()!;
    await writeFinance('d-red', head.id, { t: 'debt_changed', patch: { deleted: false } });
  });

  it('deduct, then the debts go: locked with its own words; set 0 on the summary; unlocked', async () => {
    // red owes only the small debt now: the loan is taken out for this test
    const loan = (await all()).filter((e) => e.targetId === 'd-red').pop()!;
    gone = await writeFinance('d-red', loan.id, { t: 'debt_changed', patch: { deleted: true } });
    await confirmAs(S);
    expect(await live(S, farm.red)).toEqual([['transfer-with-owner', 100_000]]);
    const small = (await all()).filter((e) => e.targetId === 'd-small').pop()!;
    await writeFinance('d-small', small.id, { t: 'debt_changed', patch: { deleted: true } });
    clearDraft(S);
    const p = await inSale(S, <CloseoutPayScreen />);
    expect(last(`pay-invalid-${farm.red}`)).toHaveTextContent(/ยอดหักหนี้แดงไม่ตรงกับหนี้ · แก้ที่หน้าสรุปก่อน/);
    expect(disabled(`tick-${farm.red}`)).toBe(true);
    expect(disabled('close-sale')).toBe(true);
    p.unmount();
    const r = await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-deduct-${farm.red}`)).toHaveTextContent(/−1,000\.00/);
    await press(`co-deduct-${farm.red}`);
    await press('co-quick-none');
    await press('co-deduct-ok');
    await gates(S);
    expect(last('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
    await press('co-confirm');
    r.unmount();
    expect(await live(S, farm.red)).toEqual([]);
    await inSale(S, <CloseoutPayScreen />);
    expect(screen.queryByTestId(`pay-invalid-${farm.red}`)).toBeNull();
    expect(disabled('close-sale')).toBe(false);
    expect(gone).toBeTruthy();
  });
});

describe('owner 2026-11-01 · ✓ unchanged on a double = ONE phone\'s amount, never the sum; closing without ✓ leaves the double open', () => {
  const S = 'd-one';
  beforeAll(async () => {
    await storySale(S);
    await confirmAs(S);
    await phoneBDeducts(S, RED(), 325_000);
    clearDraft(S);
  });

  it('close without ✓: still double; open again, ✓ → one 3,250 line, flag cleared, payment page unlocked', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.red}`);
    await press('co-double-both');
    await press('co-deduct-sheet-close');
    expect(last(`co-double-${farm.red}`)).toBeTruthy();
    expect(last(`co-deduct-${farm.red}`)).toHaveTextContent(/−6,500\.00/);
    await press(`co-deduct-${farm.red}`);
    expect(last('co-amount')).toHaveTextContent(/3,250/);
    await press('co-deduct-ok');
    expect(screen.queryByTestId(`co-double-${farm.red}`)).toBeNull();
    expect(last(`co-deduct-${farm.red}`)).toHaveTextContent(/−3,250\.00/);
    await gates(S);
    expect(last('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
    await press('co-confirm');
    r.unmount();
    expect(await live(S, farm.red)).toEqual([['transfer-with-owner', 325_000]]);
    await inSale(S, <CloseoutPayScreen />);
    expect(screen.queryByTestId(`pay-double-${farm.red}`)).toBeNull();
    expect(disabled(`tick-${farm.red}`)).toBe(false);
    expect(disabled('close-sale')).toBe(false);
  });
});

describe('B1 · S1: both phones deduct แดง\'s instalment 3,250 — 6,500 is inside his share 9,187.50, still never silent', () => {
  const S = 'd-s1';
  beforeAll(async () => {
    await storySale(S);
    await confirmAs(S);
    await phoneBDeducts(S, RED(), 325_000);
    clearDraft(S);
  });

  it('the payment page locks แดง\'s tick, the owner\'s transfer tick and the close, and says why', async () => {
    const r = await inSale(S, <CloseoutPayScreen />);
    expect(last(`pay-double-${farm.red}`)).toHaveTextContent(/หักหนี้แดงซ้ำจาก 2 เครื่อง · แก้ที่หน้าสรุปก่อน/);
    expect(screen.queryByTestId('pay-over')).toBeNull();
    expect(disabled(`tick-${farm.red}`)).toBe(true);
    expect(disabled('tick-owner')).toBe(true);
    expect(disabled('close-sale')).toBe(true);
    r.unmount();
  });

  it('the summary flags แดง\'s card and keeps confirm off until the owner sets his amount; confirming writes one set; the payment page unlocks', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-double-${farm.red}`)).toHaveTextContent(/หักซ้ำจาก 2 เครื่อง · แตะเพื่อแก้/);
    expect(screen.queryByTestId(`co-double-${farm.nat}`)).toBeNull();
    expect(last(`co-deduct-${farm.red}`)).toHaveTextContent(/−6,500\.00/);
    await gates(S);
    expect(last('co-confirm')).toHaveTextContent('↑ แก้หักหนี้ซ้ำของแดงก่อน');
    expect(disabled('co-confirm')).toBe(true);
    await press(`co-deduct-${farm.red}`);
    expect(last('co-double-warn')).toHaveTextContent(/หักซ้ำจาก 2 เครื่อง/);
    // owner 2026-11-01: the sheet proposes ONE phone's amount; the sum is a button of its own
    expect(last('co-amount')).toHaveTextContent(/3,250/);
    expect(last('co-amount')).not.toHaveTextContent(/6,500/);
    expect(last('co-double-both')).toHaveTextContent('หักทั้งสอง (6,500)');
    await press('co-deduct-ok');
    expect(screen.queryByTestId(`co-double-${farm.red}`)).toBeNull();
    expect(last('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
    await press('co-confirm');
    r.unmount();
    expect(await live(S, farm.red)).toEqual([['transfer-with-owner', 325_000]]);
    const es = await all();
    const liveRed = es.filter((e) => e.payload.t === 'debt_payment_recorded' && e.payload.fields.saleId === S && e.payload.fields.worker.id === farm.red && !es.some((x) => x.targetId === e.targetId && x.payload.t === 'debt_payment_changed'));
    expect(liveRed.map((e) => e.actor.deviceId)).not.toContain('phone-B');
    await inSale(S, <CloseoutPayScreen />);
    expect(screen.queryByTestId(`pay-double-${farm.red}`)).toBeNull();
    expect(disabled(`tick-${farm.red}`)).toBe(false);
    expect(disabled('close-sale')).toBe(false);
  });
});

describe('owner 2026-11-01 · "หักทั้งสอง" on the deduct sheet sets the sum on purpose: the two phones\' lines become one set of 6,500', () => {
  const S = 'd-keep';
  beforeAll(async () => {
    await storySale(S);
    await confirmAs(S);
    await phoneBDeducts(S, RED(), 325_000);
    clearDraft(S);
  });

  it('the double is gone after confirm, and the sum stays 6,500 because the owner chose หักทั้งสอง', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.red}`);
    await press('co-double-both');
    expect(last('co-amount')).toHaveTextContent(/6,500/);
    await press('co-deduct-ok');
    expect(screen.queryByTestId(`co-double-${farm.red}`)).toBeNull();
    await gates(S);
    await press('co-confirm');
    r.unmount();
    expect(await live(S, farm.red)).toEqual([['transfer-with-owner', 650_000]]);
    await inSale(S, <CloseoutPayScreen />);
    expect(screen.queryByTestId(`pay-double-${farm.red}`)).toBeNull();
    expect(disabled('close-sale')).toBe(false);
  });
});

describe('N5 · the confirm button names each invalid problem in the deduct sheet\'s words', () => {
  const S = 'd-n5';
  beforeAll(() => storySale(S));
  beforeEach(() => clearDraft(S));

  it.each([
    [{ totalSatang: 600_000 }, 'ยอดหักเกินที่หักได้ · แก้ก่อน'],
    [{ nettingSatang: 70_000 }, 'หักกลบได้ไม่เกิน 640 · แก้ก่อน'],
    [{ nettingSatang: 64_000, totalSatang: 30_000 }, 'ยอดหักต้องไม่น้อยกว่าหักกลบ 640 · แก้ก่อน'],
  ])('นัด %j → %s', async (draft, text) => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await gates(S);
    await act(async () => updateDraft(S, (d) => ({ ...d, workers: { [farm.nat]: draft } })));
    await flush();
    expect(last('co-confirm')).toHaveTextContent(text);
    expect(disabled('co-confirm')).toBe(true);
    r.unmount();
  });
});

describe('B1 · S3: both phones net นัด\'s 640 — netting 1,280 over what the farm owes', () => {
  const S = 'd-s3';
  beforeAll(async () => {
    await storySale(S);
    await confirmAs(S, async () => {
      await act(async () => updateDraft(S, (d) => ({ ...d, workers: { [farm.nat]: { nettingSatang: 64_000, totalSatang: 589_000 } } })));
      await flush();
    });
    const rep = `rep-B-${uuidv7()}`;
    await phoneBDeducts(S, NAT(), 64_000, 'netting', rep);
    await fromPhoneB(rep, { t: 'repayment_recorded', fields: { from: FARM, to: NAT(), amountSatang: 64_000, date: '2026-10-31', note: '', allocations: [{ expenseId: 'exp-nat', satang: 64_000 }], saleId: S } });
    clearDraft(S);
  });

  it('the payment page is locked for นัด; the summary fixes it with the netting the farm really owes (640)', async () => {
    const p = await inSale(S, <CloseoutPayScreen />);
    expect(last(`pay-double-${farm.nat}`)).toHaveTextContent(/หักหนี้นัดซ้ำจาก 2 เครื่อง/);
    expect(disabled('tick-owner')).toBe(true);
    expect(disabled('close-sale')).toBe(true);
    p.unmount();
    const r = await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-double-${farm.nat}`)).toBeTruthy();
    await press(`co-deduct-${farm.nat}`);
    // the phones wrote different sets (A: 640 + 5,250, B: 640 only): the sheet proposes the plan's normal amount, no netting
    expect(last('co-amount')).toHaveTextContent(/5,250/);
    expect(screen.queryByTestId('co-net-on')).toBeNull();
    expect(screen.queryByTestId('co-cap')).toBeNull();
    // review 3 · NB1: both phones' netting 1,280 is over what the farm owes — no หักทั้งสอง, the reason instead
    expect(screen.queryByTestId('co-double-both')).toBeNull();
    expect(last('co-double-both-why')).toHaveTextContent('หักทั้งสองไม่ได้ · หักกลบได้ไม่เกิน 640');
    await press('co-net-link');
    await press('co-deduct-ok');
    await gates(S);
    expect(last('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
    await press('co-confirm');
    r.unmount();
    expect((await live(S, farm.nat)).filter(([m]) => m === 'netting')).toEqual([['netting', 64_000]]);
    expect((await liveRepayments(S)).map((e) => (e.payload.t === 'repayment_recorded' ? e.payload.fields.amountSatang : 0))).toEqual([64_000]);
    expect(await owedToNat()).toBe(0);
    await inSale(S, <CloseoutPayScreen />);
    expect(screen.queryByTestId(`pay-double-${farm.nat}`)).toBeNull();
    expect(disabled('close-sale')).toBe(false);
  });
});

describe('owner 2026-11-01 · S3 analog: both phones write the same set for นัด (หักกลบ 640 + 5,250) — the sheet proposes one set, netting 640', () => {
  const S = 'd-s3-one';
  beforeAll(async () => {
    // B1 · S3 above repaid exp-nat: the farm owes นัด a fresh 640 here
    await writeFinance('exp-nat-2', null, { t: 'expense_created', fields: { amountSatang: 64_000, date: '2026-10-26', stage: 'actual', categoryId: null, propertyId: null, item: 'ค่าปุ๋ย', note: '', payer: NAT() } });
    await storySale(S);
    await confirmAs(S, async () => {
      await act(async () => updateDraft(S, (d) => ({ ...d, workers: { [farm.nat]: { nettingSatang: 64_000, totalSatang: 589_000 } } })));
      await flush();
    });
    const rep = `rep-B-${uuidv7()}`;
    await phoneBDeducts(S, NAT(), 64_000, 'netting', rep);
    await fromPhoneB(rep, { t: 'repayment_recorded', fields: { from: FARM, to: NAT(), amountSatang: 64_000, date: '2026-10-31', note: '', allocations: [{ expenseId: 'exp-nat-2', satang: 64_000 }], saleId: S } });
    await phoneBDeducts(S, NAT(), 525_000);
    clearDraft(S);
  });

  it('✓ unchanged → one netting 640 with its one repayment, one route line; the farm owes นัด nothing; unlocked', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    expect(last('co-net-field')).toHaveTextContent(/640/);
    expect(last('co-amount')).toHaveTextContent(/5,890/);
    expect(screen.queryByTestId('co-cap')).toBeNull();
    // review 3 · NB1: the sum nets 1,280, over the 640 the farm owes — the reason instead of หักทั้งสอง (11,780)
    expect(screen.queryByTestId('co-double-both')).toBeNull();
    expect(last('co-double-both-why')).toHaveTextContent('หักทั้งสองไม่ได้ · หักกลบได้ไม่เกิน 640');
    await press('co-deduct-ok');
    expect(screen.queryByTestId(`co-double-${farm.nat}`)).toBeNull();
    await gates(S);
    expect(last('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
    await press('co-confirm');
    r.unmount();
    expect(await live(S, farm.nat)).toEqual([['netting', 64_000], ['transfer-with-owner', 525_000]]);
    expect((await liveRepayments(S)).map((e) => (e.payload.t === 'repayment_recorded' ? e.payload.fields.amountSatang : 0))).toEqual([64_000]);
    expect(await owedToNat()).toBe(0);
    await inSale(S, <CloseoutPayScreen />);
    expect(screen.queryByTestId(`pay-double-${farm.nat}`)).toBeNull();
    expect(disabled('close-sale')).toBe(false);
  });
});

describe('N3 · after a failed confirm the checks stay tracked: the other phone\'s line landing later still asks again', () => {
  const S = 'd-n3';
  beforeAll(() => storySale(S));

  it('first write lands, second fails; the checks stand (own writes); then phone B\'s line for แดง syncs → แดง\'s check drops', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await gates(S);
    let calls = 0;
    const real = financeStore.append.bind(financeStore);
    const spy = jest.spyOn(financeStore, 'append').mockImplementation(async (e) => {
      calls += 1;
      if (calls === 2) throw new Error('disk full');
      return real(e);
    });
    await press('co-confirm');
    spy.mockRestore();
    expect(last('co-confirm-error')).toBeTruthy();
    // own partial writes: the checks stand
    expect(last('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
    r.unmount();
    await phoneBDeducts(S, RED(), 325_000);
    await inSale(S, <CloseoutSummaryScreen />);
    expect(last('co-confirm')).toHaveTextContent('↑ ตรวจหนี้ของแดงก่อน');
    await act(async () => clearDraft(S));
  });
});

// ── review 3 (B1, NB1, NB5): only the deduct sheet's one/both choice clears a double ──

const selected = (id: string) => !!last(id).props.accessibilityState?.selected;

describe('review 3 · B1 Scenario A: a double for นัด while the farm owes him 640 — the owed sheet waits for the deduct sheet\'s choice', () => {
  const S = 'd-r3a';
  beforeAll(async () => {
    // the S3 tests above repaid exp-nat and exp-nat-2: the farm owes นัด a fresh 640 here
    await writeFinance('exp-nat-3', null, { t: 'expense_created', fields: { amountSatang: 64_000, date: '2026-10-27', stage: 'actual', categoryId: null, propertyId: null, item: 'ค่าปุ๋ย', note: '', payer: NAT() } });
    await storySale(S);
    await confirmAs(S);
    const lines = await live(S, farm.nat);
    expect(lines).toHaveLength(1);
    await phoneBDeducts(S, NAT(), lines[0][1]);
    clearDraft(S);
  });

  it('the owed sheet\'s choices for นัด are off with "แก้หักซ้ำที่แถวหักหนี้ของนัดก่อน"; tapping ↗ หักกลบ changes nothing; confirm stays on the double', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-double-${farm.nat}`)).toBeTruthy();
    const card = last(`co-deduct-${farm.nat}`).props.children;
    await press('co-owed-open');
    expect(last(`co-owed-double-${farm.nat}`)).toHaveTextContent('แก้หักซ้ำที่แถวหักหนี้ของนัดก่อน');
    expect(disabled(`co-owed-net-${farm.nat}`)).toBe(true);
    expect(disabled(`co-owed-hold-${farm.nat}`)).toBe(true);
    await press(`co-owed-net-${farm.nat}`);
    expect(selected(`co-owed-net-${farm.nat}`)).toBe(false);
    await press('co-owed-ok');
    await press('co-debt-open');
    await press('co-debt-ok');
    expect(last(`co-double-${farm.nat}`)).toBeTruthy();
    expect(last(`co-deduct-${farm.nat}`).props.children).toEqual(card);
    expect(last('co-confirm')).toHaveTextContent('↑ แก้หักหนี้ซ้ำของนัดก่อน');
    expect(disabled('co-confirm')).toBe(true);
    r.unmount();
    clearDraft(S);
  });
});

describe('review 3 · B1 Scenario B: both phones net นัด\'s 640 — the owed sheet never shows "ไว้ก่อน" as chosen, and tapping it voids nothing', () => {
  const S = 'd-r3b';
  beforeAll(async () => {
    await storySale(S);
    await confirmAs(S, async () => {
      await act(async () => updateDraft(S, (d) => ({ ...d, workers: { [farm.nat]: { nettingSatang: 64_000, totalSatang: 64_000 } } })));
      await flush();
    });
    const rep = `rep-B-${uuidv7()}`;
    await phoneBDeducts(S, NAT(), 64_000, 'netting', rep);
    await fromPhoneB(rep, { t: 'repayment_recorded', fields: { from: FARM, to: NAT(), amountSatang: 64_000, date: '2026-10-31', note: '', allocations: [{ expenseId: 'exp-nat-3', satang: 64_000 }], saleId: S } });
    clearDraft(S);
  });

  it('the recorded lines net: ↗ หักกลบ shows chosen (off), ไว้ก่อน not; tapping ไว้ก่อน keeps the gate on the double', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-double-${farm.nat}`)).toBeTruthy();
    await press('co-owed-open');
    expect(selected(`co-owed-hold-${farm.nat}`)).toBe(false);
    expect(selected(`co-owed-net-${farm.nat}`)).toBe(true);
    expect(disabled(`co-owed-hold-${farm.nat}`)).toBe(true);
    expect(last(`co-owed-double-${farm.nat}`)).toHaveTextContent('แก้หักซ้ำที่แถวหักหนี้ของนัดก่อน');
    await press(`co-owed-hold-${farm.nat}`);
    expect(selected(`co-owed-hold-${farm.nat}`)).toBe(false);
    await press('co-owed-ok');
    await press('co-debt-open');
    await press('co-debt-ok');
    expect(last(`co-double-${farm.nat}`)).toBeTruthy();
    expect(last('co-confirm')).toHaveTextContent('↑ แก้หักหนี้ซ้ำของนัดก่อน');
    expect(disabled('co-confirm')).toBe(true);
    r.unmount();
    expect((await live(S, farm.nat)).filter(([m]) => m === 'netting')).toEqual([['netting', 64_000], ['netting', 64_000]]);
    clearDraft(S);
  });
});

describe('review 3 · NB5: opening the deduct sheet on a double proposes one phone\'s amount without writing it; only ✓ does', () => {
  const S = 'd-r3c';
  beforeAll(async () => {
    await storySale(S);
    await confirmAs(S);
    await phoneBDeducts(S, RED(), 325_000);
    clearDraft(S);
  });

  it('open: the sheet shows 3,250 and its cash, the card still the doubled 6,500; unmount without closing → still double', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.red}`);
    expect(last('co-amount')).toHaveTextContent(/3,250/);
    // the one set's figures (share 9,187.50 − 3,250), not the doubled 6,500's
    expect(last('co-res-cash')).toHaveTextContent(/5,93\d/);
    expect(last(`co-deduct-${farm.red}`)).toHaveTextContent(/−6,500\.00/);
    r.unmount();
    const r2 = await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-double-${farm.red}`)).toBeTruthy();
    expect(last(`co-deduct-${farm.red}`)).toHaveTextContent(/−6,500\.00/);
    await gates(S);
    expect(last('co-confirm')).toHaveTextContent('↑ แก้หักหนี้ซ้ำของแดงก่อน');
    r2.unmount();
  });

  it('a key typed, then unmounted without ✓ → still double; close without ✓ → still double; ✓ → cleared', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.red}`);
    await press('co-quick-half');
    r.unmount();
    const r2 = await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-double-${farm.red}`)).toBeTruthy();
    await press(`co-deduct-${farm.red}`);
    await press('co-deduct-sheet-close');
    expect(last(`co-double-${farm.red}`)).toBeTruthy();
    await press(`co-deduct-${farm.red}`);
    expect(last('co-amount')).toHaveTextContent(/3,250/);
    await press('co-deduct-ok');
    expect(screen.queryByTestId(`co-double-${farm.red}`)).toBeNull();
    await gates(S);
    expect(last('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
    r2.unmount();
    clearDraft(S);
  });
});

describe('review 3 · NB1: "หักทั้งสอง" gives way to the reason when the sum cannot be deducted', () => {
  const S = 'd-r3d';
  beforeAll(async () => {
    await storySale(S);
    await confirmAs(S);
    // 3,250 + 7,000 = 10,250 over แดง's share 9,187.50 (the S2 shape: the sum over what can be deducted)
    await phoneBDeducts(S, RED(), 700_000);
    clearDraft(S);
  });

  it('not offered, says why; the one amount stays', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.red}`);
    expect(screen.queryByTestId('co-double-both')).toBeNull();
    expect(last('co-double-both-why')).toHaveTextContent('หักทั้งสองไม่ได้ · หักได้ไม่เกิน 9,187.50');
    expect(last('co-amount')).toHaveTextContent(/3,250/);
    expect(last('co-amount')).not.toHaveTextContent(/10,250/);
    r.unmount();
    clearDraft(S);
  });
});

// ── review 4 · B1′: a one / both choice counts only on the lines it was made on ──

/** A line a THIRD phone wrote (device phone-C), landing by sync. */
async function fromPhoneC(saleId: string, worker: { id: string; name: string }, amountSatang: number): Promise<FinanceEvent> {
  const any = (await all())[0];
  const e: FinanceEvent = {
    id: uuidv7(),
    groupId: any.groupId,
    deviceSeq: 1 + (await all()).filter((x) => x.actor.deviceId === 'phone-C').length,
    ts: Date.now(),
    actor: { userId: any.actor.userId, deviceId: 'phone-C' },
    source: 'app',
    targetId: `dpay-C-${uuidv7()}`,
    baseEventId: null,
    payload: { t: 'debt_payment_recorded', fields: { worker, creditor: FARM, amountSatang, date: '2026-10-31', note: '', method: 'transfer-with-owner', saleId } },
  };
  await financeStore.append(e);
  return e;
}
/** The open page's finance reader reloads (what a sync landing does while the page stays open). */
const synced = async () => {
  await act(async () => mockFocused.forEach((f) => f()));
  await flush();
};

describe('review 4 · B1′ R4-1: ✓ one on phones A + B, then phone C\'s 3,250 lands — the 3-phone double opens again', () => {
  const S = 'd-r4a';
  beforeAll(async () => {
    await storySale(S);
    await confirmAs(S);
    await phoneBDeducts(S, RED(), 325_000);
    clearDraft(S);
  });

  it('chip and gate come back; ✓ again on the three phones\' lines writes one 3,250', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.red}`);
    await press('co-deduct-ok');
    expect(screen.queryByTestId(`co-double-${farm.red}`)).toBeNull();
    r.unmount();
    await fromPhoneC(S, RED(), 325_000);
    const r2 = await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-double-${farm.red}`)).toBeTruthy();
    // the card shows what is recorded (9,750), not the 3,250 chosen on two phones' lines
    expect(last(`co-deduct-${farm.red}`)).toHaveTextContent(/−9,750\.00/);
    await gates(S);
    expect(last('co-confirm')).toHaveTextContent('↑ แก้หักหนี้ซ้ำของแดงก่อน');
    await press(`co-deduct-${farm.red}`);
    expect(last('co-double-warn')).toHaveTextContent(/หักซ้ำจาก 3 เครื่อง/);
    expect(last('co-amount')).toHaveTextContent(/3,250/);
    await press('co-deduct-ok');
    expect(screen.queryByTestId(`co-double-${farm.red}`)).toBeNull();
    await gates(S);
    expect(last('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
    await press('co-confirm');
    r2.unmount();
    expect(await live(S, farm.red)).toEqual([['transfer-with-owner', 325_000]]);
    clearDraft(S);
  });
});

describe('review 4 · B1′ R4-2: หักทั้งสอง 6,500 ✓, then phone B voids its line and writes 2,000 — no 6,500 nobody records', () => {
  const S = 'd-r4b';
  let bEvt: FinanceEvent;
  beforeAll(async () => {
    await storySale(S);
    await confirmAs(S);
    bEvt = await phoneBDeducts(S, RED(), 325_000);
    clearDraft(S);
  });

  it('chip and gate come back on 5,250 recorded; the sheet proposes from those lines; ✓ writes one 3,250', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.red}`);
    await press('co-double-both');
    await press('co-deduct-ok');
    expect(screen.queryByTestId(`co-double-${farm.red}`)).toBeNull();
    r.unmount();
    await fromPhoneB(bEvt.targetId, { t: 'debt_payment_changed', patch: { deleted: true } } as FinancePayload, bEvt.id);
    await phoneBDeducts(S, RED(), 200_000);
    const r2 = await inSale(S, <CloseoutSummaryScreen />);
    expect(last(`co-double-${farm.red}`)).toBeTruthy();
    expect(last(`co-deduct-${farm.red}`)).toHaveTextContent(/−5,250\.00/);
    await gates(S);
    expect(last('co-confirm')).toHaveTextContent('↑ แก้หักหนี้ซ้ำของแดงก่อน');
    await press(`co-deduct-${farm.red}`);
    expect(last('co-amount')).toHaveTextContent(/3,250/);
    expect(selected('co-double-both')).toBe(false);
    expect(last('co-double-both')).toHaveTextContent(/5,250/);
    await press('co-deduct-ok');
    await gates(S);
    await press('co-confirm');
    r2.unmount();
    expect(await live(S, farm.red)).toEqual([['transfer-with-owner', 325_000]]);
    clearDraft(S);
  });
});

describe('review 4 · B1′ variant: a sync lands while the deduct sheet is open — the sheet proposes again from the lines now recorded', () => {
  const S = 'd-r4c';
  beforeAll(async () => {
    await storySale(S);
    await confirmAs(S);
    await phoneBDeducts(S, RED(), 325_000);
    clearDraft(S);
  });

  it('หักทั้งสอง (6,500) pressed, phone C lands: the 6,500 is dropped, the sheet shows 3,250 and 3 phones; ✓ writes one 3,250', async () => {
    const r = await inSale(S, <CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.red}`);
    await press('co-double-both');
    expect(last('co-amount')).toHaveTextContent(/6,500/);
    await fromPhoneC(S, RED(), 325_000);
    await synced();
    expect(last('co-double-warn')).toHaveTextContent(/หักซ้ำจาก 3 เครื่อง/);
    expect(last('co-amount')).toHaveTextContent(/3,250/);
    expect(last('co-amount')).not.toHaveTextContent(/6,500/);
    // the three phones' 9,750 is over his share 9,187.50: the reason shows instead of หักทั้งสอง (NB1)
    expect(screen.queryByTestId('co-double-both')).toBeNull();
    expect(last('co-double-both-why')).toBeTruthy();
    await press('co-deduct-ok');
    expect(screen.queryByTestId(`co-double-${farm.red}`)).toBeNull();
    await gates(S);
    expect(last('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
    await press('co-confirm');
    r.unmount();
    expect(await live(S, farm.red)).toEqual([['transfer-with-owner', 325_000]]);
    clearDraft(S);
  });

  it('a sync while the sheet is open on an unchanged proposal still leaves ✓ on the lines now recorded (no stale choice)', async () => {
    const S2 = 'd-r4d';
    await storySale(S2);
    await confirmAs(S2);
    await phoneBDeducts(S2, RED(), 325_000);
    clearDraft(S2);
    const r = await inSale(S2, <CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.red}`);
    await fromPhoneC(S2, RED(), 325_000);
    await synced();
    await press('co-deduct-ok');
    r.unmount();
    // a fourth phone after the ✓: open again
    await fromPhoneC(S2, RED(), 100_000);
    const r2 = await inSale(S2, <CloseoutSummaryScreen />);
    expect(last(`co-double-${farm.red}`)).toBeTruthy();
    r2.unmount();
    clearDraft(S2);
  });
});
