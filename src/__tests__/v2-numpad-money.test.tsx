/**
 * E01-S20 NP-4 characterization: the money screens' number fields (story rows 1–8, 12) save the
 * same payload whatever way the number is typed. Written against the old TextFields first; when
 * the fields moved to the app's number pad only `enter` below changed — every assertion stayed.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { projectFinance } from '../core/finance/ledger';
import type { ExpenseFields, FinanceEvent } from '../core/finance/types';
import { financeStore as mockFinance } from '../store/finance';
import { peopleStore as mockPeople } from '../store/people';
import { wrap } from '../test/render';
import { ExpenseFormScreen } from '../v2/money/expense-form-screen';
import { FertilizerSettingsScreen } from '../v2/money/fertilizer-settings';
import { RepayScreen } from '../v2/money/repay-screen';

jest.mock('../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
});
jest.mock('../store/people', () => {
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { peopleStore: new MemoryPeopleStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('expo-router', () => {
  const params: { current: Record<string, string> } = { current: {} };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => params.current,
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
    router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false },
    __params: params,
  };
});
const { __params: mockParams, router: mockRouter } = jest.requireMock('expo-router') as {
  __params: { current: Record<string, string> };
  router: { replace: jest.Mock };
};

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));

/** Owner q2 = ก (2026-11-08): a field whose screen never saves 0 shuts ตกลง at 0 and says so at the pad. */
const shutAtZero = (field: string) => {
  expect(screen.getByTestId(`${field}-done`).props.accessibilityState).toMatchObject({ disabled: true });
  expect(screen.getByTestId(`${field}-problem`)).toHaveTextContent('ต้องมากกว่า 0');
};
/**
 * How a number is typed into a field — the only part that changed when the fields moved to the pad
 * (it was `fireEvent.changeText`). Open the card, press the keys, then ตกลง (money) or ✓ (whole
 * numbers); a value the pad refuses leaves its sheet open, which is closed without saving it.
 */
function enter(id: string, text: string) {
  press(id);
  for (const k of text) press(`${id}-pad-key-${k}`);
  press(screen.queryByTestId(`${id}-done`) ? `${id}-done` : `${id}-pad-key-done`);
  if (screen.queryByTestId(`${id}-sheet`)) press(`${id}-sheet-scrim`);
}

let seq = 0;
async function seed(targetId: string, payload: FinanceEvent['payload']) {
  seq += 1;
  await mockFinance.append({ id: `seed-${String(seq).padStart(3, '0')}`, groupId: 'group-1', deviceSeq: seq, ts: seq, actor: { userId: 'u', deviceId: 'dev-other' }, source: 'app', targetId, baseEventId: null, payload });
}
async function seedExpense(id: string, over: Partial<ExpenseFields>) {
  await seed(id, { t: 'expense_created', fields: { amountSatang: 1000, date: '2026-09-01', stage: 'actual', categoryId: null, propertyId: null, item: '', note: '', payer: null, ...over } });
}

const events = () => mockFinance.load();
const expenses = async () => projectFinance(await events()).expenses;
const created = async () => (await events()).filter((e) => e.payload.t === 'expense_created' && e.actor.deviceId !== 'dev-other');

/** A category tile when it is one of the five, else through "อื่น ๆ". */
function pickCat(id: string) {
  if (screen.queryByTestId(`expense-cat-${id}`)) return press(`expense-cat-${id}`);
  press('expense-cat-more');
  press(`expense-catall-${id}`);
}

async function saveExpense() {
  await act(async () => press('expense-save'));
  await flush();
}

async function newExpense() {
  mockParams.current = { id: 'new' };
  wrap(<ExpenseFormScreen />);
  await flush();
}

let daengId = '';
beforeAll(async () => {
  daengId = (await mockPeople.create('แดง', ['tapper'])).id;
  await seed('cat-repair', { t: 'category_share_set', workerPct: 50 });
});
beforeEach(() => mockRouter.replace.mockClear());

describe('row 1 · expense-amount (parseBahtToSatang → amountSatang)', () => {
  it.each([
    ['640', 64_000],
    ['1250.5', 125_050],
    ['12.25', 1_225],
    ['0', 0],
    ['99999999.99', 9_999_999_999],
  ])('%s saves %d satang', async (text, satang) => {
    const before = (await created()).length;
    await newExpense();
    enter('expense-amount', text);
    pickCat('cat-fuel');
    await saveExpense();
    const mine = await created();
    expect(mine).toHaveLength(before + 1);
    expect((mine[mine.length - 1].payload as { fields: ExpenseFields }).fields.amountSatang).toBe(satang);
  });

  it('empty: refused with the amount error, nothing written', async () => {
    const before = (await events()).length;
    await newExpense();
    await saveExpense();
    expect(screen.getByTestId('expense-amount-error')).toBeTruthy();
    expect(await events()).toHaveLength(before);
  });

  it('the amount typed goes with the fertilizer category to the shop order', async () => {
    await newExpense();
    enter('expense-amount', '10000');
    pickCat('cat-fertilizer');
    const { parseBahtToSatang } = jest.requireActual('../core/finance/money');
    const params = (mockRouter.replace.mock.calls[0][0] as { params: { amount: string } }).params;
    expect(parseBahtToSatang(params.amount)).toBe(1_000_000);
  });
});

describe('rows 2–3 · trip lines and split per farm', () => {
  async function trip() {
    await newExpense();
    pickCat('cat-travel');
    fireEvent.changeText(screen.getByTestId('trip-farms'), 'สวนบน, สวนล่าง');
  }
  const lastTrip = async () => (await expenses()).filter((x) => x.trip).pop()!;

  it('lines add up to the amount; a 0 line is left out', async () => {
    await trip();
    enter('trip-line-fuel', '300');
    enter('trip-line-toll', '45.5');
    enter('trip-line-food', '0');
    await saveExpense();
    const x = await lastTrip();
    expect(x.amountSatang).toBe(34_550);
    expect(x.trip!.lines).toEqual([{ kind: 'fuel', satang: 30_000 }, { kind: 'toll', satang: 4_550 }]);
  });

  it('a split that adds up is saved per farm', async () => {
    await trip();
    enter('trip-line-fuel', '300');
    press('trip-split');
    enter('trip-split-สวนบน', '200.25');
    enter('trip-split-สวนล่าง', '99.75');
    await saveExpense();
    expect((await lastTrip()).trip!.split).toEqual([{ farmId: 'farm:สวนบน', satang: 20_025 }, { farmId: 'farm:สวนล่าง', satang: 9_975 }]);
  });

  it('a split that does not add up: the old error, nothing written', async () => {
    await trip();
    enter('trip-line-fuel', '300');
    press('trip-split');
    enter('trip-split-สวนบน', '200');
    enter('trip-split-สวนล่าง', '50');
    const before = (await events()).length;
    await saveExpense();
    expect(screen.getByTestId('trip-err-split')).toBeTruthy();
    expect(await events()).toHaveLength(before);
  });
});

describe('rows 4–5 · share sheet: discount and tapper %', () => {
  async function share(amount: string) {
    await newExpense();
    enter('expense-amount', amount);
    pickCat('cat-repair');
    press('share-row');
    await flush();
    press(`share-worker-${daengId}`);
  }
  const lastShare = async () => (await expenses()).filter((x) => x.share).pop()!.share!;

  it.each([
    ['100', 10_000],
    ['0.5', 50],
    ['1000', 100_000],
  ])('discount %s → %d satang (bill 1,000)', async (text, satang) => {
    await share('1000');
    press('share-discount-switch');
    enter('share-discount', text);
    press('share-done');
    await saveExpense();
    expect(await lastShare()).toMatchObject({ billSatang: 100_000, discountSatang: satang });
  });

  it('switching the discount off clears it to 0', async () => {
    await share('1000');
    press('share-discount-switch');
    enter('share-discount', '100');
    press('share-discount-switch');
    press('share-done');
    await saveExpense();
    expect((await lastShare()).discountSatang).toBe(0);
  });

  it('a discount above the bill is never saved', async () => {
    await share('1000');
    press('share-discount-switch');
    enter('share-discount', '1000.01');
    press('share-done');
    await saveExpense();
    expect((await expenses()).some((x) => x.share && x.share.discountSatang > x.share.billSatang)).toBe(false);
  });

  it('the bill lowered under a discount already set: the error on the form, nothing written', async () => {
    await share('1000');
    press('share-discount-switch');
    enter('share-discount', '500');
    press('share-done');
    enter('expense-amount', '200');
    const before = (await events()).length;
    await saveExpense();
    expect(screen.getByTestId('share-err')).toBeTruthy();
    expect(await events()).toHaveLength(before);
  });

  it.each([
    ['30', 30],
    ['0', 0],
    ['100', 100],
  ])('tapper %s%% → workerPct %d', async (text, pct) => {
    await share('1000');
    enter('share-pct', text);
    press('share-done');
    await saveExpense();
    expect((await lastShare()).lines[0].workerPct).toBe(pct);
  });

  it('a % above 100 is never saved', async () => {
    await share('1000');
    enter('share-pct', '101');
    press('share-done');
    await saveExpense();
    expect((await expenses()).some((x) => x.share?.lines.some((l) => l.workerPct > 100))).toBe(false);
  });
});

describe('row 6 · category share %', () => {
  async function setPct(cat: string, text: string) {
    await newExpense();
    pickCat(cat);
    press('expense-cat-more');
    press('expense-cat-share');
    press('cat-share-switch');
    enter('cat-share-pct', text);
    await act(async () => press('cat-share-save'));
    await flush();
  }
  const pctOf = async (cat: string) => projectFinance(await events()).categories.find((c) => c.id === cat)?.workerPct;

  it.each([
    ['cat-fuel', '30', 30],
    ['cat-salary', '0', 0],
    ['cat-other', '100', 100],
  ])('%s %s%% → %d', async (cat, text, pct) => {
    await setPct(cat, text);
    expect(await pctOf(cat)).toBe(pct);
  });

  it('above 100 is never saved', async () => {
    await setPct('cat-labour', '101');
    expect((await events()).some((e) => e.payload.t === 'category_share_set' && (e.payload.workerPct ?? 0) > 100)).toBe(false);
  });
});

describe('rows 7–8 · repay amount and the split by hand', () => {
  let n = 0;
  /** A payer owed 800.00 (older) and 400.00. */
  async function owed() {
    n += 1;
    const payer = { id: `p-rp${n}`, name: `คนที่ ${n}` };
    await seedExpense(`rp${n}-a`, { amountSatang: 80_000, date: '2026-09-15', payer });
    await seedExpense(`rp${n}-b`, { amountSatang: 40_000, date: '2026-09-22', payer });
    mockParams.current = { payerId: payer.id };
    wrap(<RepayScreen />);
    await flush();
    return { a: `rp${n}-a`, b: `rp${n}-b`, payer };
  }
  async function save() {
    await act(async () => press('repay-save'));
    await flush();
  }
  const repaymentsTo = async (id: string) => projectFinance(await events()).repayments.filter((r) => r.to.id === id);

  it.each([
    ['1000', 100_000, [80_000, 20_000]],
    ['12.5', 1_250, [1_250]],
    ['1200', 120_000, [80_000, 40_000]],
  ])('%s → %d satang, oldest first', async (text, satang, split) => {
    const { payer } = await owed();
    enter('repay-amount', text);
    await save();
    const [r] = await repaymentsTo(payer.id);
    expect(r.amountSatang).toBe(satang);
    expect(r.allocations.map((a) => a.satang)).toEqual(split);
  });

  it('0 on the pad: ตกลง is shut and says ต้องมากกว่า 0 (owner q2 = ก)', async () => {
    await owed();
    press('repay-amount');
    press('repay-amount-pad-key-0');
    shutAtZero('repay-amount');
  });

  it('0 is never saved: the pad refuses it, so the amount stays the full balance (owner q2 = ก)', async () => {
    const { payer } = await owed();
    enter('repay-amount', '0');
    await save();
    expect((await repaymentsTo(payer.id)).map((r) => r.amountSatang)).toEqual([120_000]);
  });

  it('more than is owed is never saved', async () => {
    const { payer } = await owed();
    enter('repay-amount', '1300');
    await save();
    expect((await repaymentsTo(payer.id)).some((r) => r.amountSatang > 120_000)).toBe(false);
  });

  it('by hand: each item its own amount; a 0 item is left out', async () => {
    const { a, b, payer } = await owed();
    press('repay-mode');
    enter(`repay-manual-${a}`, '500.5');
    enter(`repay-manual-${b}`, '0');
    await save();
    const [r] = await repaymentsTo(payer.id);
    expect(r.amountSatang).toBe(50_050);
    expect(r.allocations).toEqual([{ expenseId: a, satang: 50_050 }]);
  });

  it('by hand: more than an item still owes is never saved', async () => {
    const { a, payer } = await owed();
    press('repay-mode');
    enter(`repay-manual-${a}`, '800.01');
    await save();
    expect((await repaymentsTo(payer.id)).some((r) => r.allocations.some((x) => x.expenseId === a && x.satang > 80_000))).toBe(false);
  });
});

describe('row 12 · fertilizer default %', () => {
  const fertPcts = async () => (await events()).filter((e) => e.targetId === 'cat-fertilizer' && e.payload.t === 'category_share_set').map((e) => (e.payload as { workerPct: number }).workerPct);

  it.each([
    ['40', 40],
    ['0', 0],
    ['100', 100],
  ])('%s%% → %d', async (text, pct) => {
    wrap(<FertilizerSettingsScreen />);
    await flush();
    enter('fert-set-pct', text);
    await act(async () => press('fert-set-pct-save'));
    await flush();
    expect((await fertPcts()).pop()).toBe(pct);
  });

  it('above 100 is never saved', async () => {
    wrap(<FertilizerSettingsScreen />);
    await flush();
    enter('fert-set-pct', '101');
    await act(async () => press('fert-set-pct-save'));
    await flush();
    expect((await fertPcts()).some((p) => p > 100)).toBe(false);
  });
});

/** E01-S20 on the pad itself: what the old boxes could not do (NP-5, NP-6, Q5). */
describe('on the pad (NP-5, NP-6)', () => {
  let n2 = 0;
  const keys = (id: string, text: string) => {
    press(id);
    for (const k of text) press(`${id}-pad-key-${k}`);
  };
  const off = (id: string) => screen.getByTestId(id).props.accessibilityState.disabled;

  it('expense amount: Thai words under the figure; trip lines without', async () => {
    await newExpense();
    keys('expense-amount', '1500');
    expect(screen.getByTestId('expense-amount-words')).toHaveTextContent('หนึ่งพันห้าร้อยบาทถ้วน');
    press('expense-amount-done');
    expect(screen.getByTestId('expense-amount')).toHaveTextContent(/1,500/);
    pickCat('cat-travel');
    keys('trip-line-fuel', '300');
    expect(screen.queryByTestId('trip-line-fuel-words')).toBeNull();
  });

  it('discount over the bill: ตกลง off with the old reason; "เว้นว่าง (ไม่มี)" clears it back to none', async () => {
    await newExpense();
    enter('expense-amount', '1000');
    pickCat('cat-repair');
    press('share-row');
    await flush();
    press(`share-worker-${daengId}`);
    press('share-discount-switch');
    keys('share-discount', '1000.01');
    expect(off('share-discount-done')).toBe(true);
    expect(screen.getByTestId('share-discount-sheet')).toHaveTextContent(/ส่วนลดมากกว่ายอดบิลไม่ได้/);
    expect(screen.queryByTestId('share-discount-words')).toBeNull();
    press('share-discount-sheet-scrim');
    enter('share-discount', '100');
    expect(screen.getByTestId('share-net')).toHaveTextContent(/900\.00/);
    press('share-discount');
    press('share-discount-clear');
    expect(screen.getByTestId('share-net')).toHaveTextContent(/1,000\.00/);
    press('share-done');
    await saveExpense();
    const x = (await expenses()).filter((e) => e.share).pop()!;
    expect(x.share).toMatchObject({ billSatang: 100_000, discountSatang: 0 });
  });

  it('% above 100: ✓ off', async () => {
    wrap(<FertilizerSettingsScreen />);
    await flush();
    keys('fert-set-pct', '101');
    expect(off('fert-set-pct-pad-key-done')).toBe(true);
  });

  it('repay: over what is owed, ตกลง off with the old reason; by hand, capped per item and no words', async () => {
    n2 += 1;
    const payer = { id: `p-pad${n2}`, name: 'คนคืน' };
    await seedExpense(`pad${n2}-a`, { amountSatang: 80_000, date: '2026-09-15', payer });
    mockParams.current = { payerId: payer.id };
    wrap(<RepayScreen />);
    await flush();
    keys('repay-amount', '900');
    expect(off('repay-amount-done')).toBe(true);
    expect(screen.getByTestId('repay-amount-sheet')).toHaveTextContent(/คืนได้ไม่เกิน 800\.00/);
    press('repay-amount-sheet-scrim');
    press('repay-mode');
    keys(`repay-manual-pad${n2}-a`, '800.01');
    expect(off(`repay-manual-pad${n2}-a-done`)).toBe(true);
    expect(screen.getByTestId(`repay-manual-pad${n2}-a-sheet`)).toHaveTextContent(/คืนเกินยอดค้างของรายการนี้/);
    expect(screen.queryByTestId(`repay-manual-pad${n2}-a-words`)).toBeNull();
  });
});
