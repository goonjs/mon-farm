import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ExpenseFormScreen as ExpenseScreen } from '../v2/money/expense-form-screen';
import { ExpensesScreen } from '../v2/money/expenses-screen';
import { OwedScreen } from '../v2/money/owed-screen';
import { tokens } from '../../design/tokens';
import { RepayScreen } from '../v2/money/repay-screen';
import { projectFinance } from '../core/finance/ledger';
import type { ExpenseFields, FinanceEvent } from '../core/finance/types';
import { FARM_FUNDS } from '../core/finance/types';
import { financeStore as mockFinance } from '../store/finance';
import { todayIso } from '../core/finance/money';
import { dayAfter } from '../core/master';
import { dayCell, pickDate } from '../test/pick-date';
import { expectChoiceTile } from '../test/choice-shape';
import { wrap } from '../test/render';

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

// Built inside the factory: jest.mock is hoisted above any outer const.
jest.mock('expo-router', () => {
  const params: { current: Record<string, string> } = { current: {} };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => params.current,
    router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false },
    __params: params,
  };
});
const { router: mockRouter, __params: mockParams } = jest.requireMock('expo-router') as {
  router: { replace: jest.Mock; push: jest.Mock };
  __params: { current: Record<string, string> };
};

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function state() {
  return projectFinance(await mockFinance.load());
}

/** Types on a field's app number pad (E01-S20): open its card, press the keys, then ตกลง / ✓. */
function typeOnPad(id: string, text: string) {
  fireEvent.press(screen.getByTestId(id));
  for (const k of text) fireEvent.press(screen.getByTestId(`${id}-pad-key-${k}`));
  fireEvent.press(screen.getByTestId(screen.queryByTestId(`${id}-done`) ? `${id}-done` : `${id}-pad-key-done`));
}

let seq = 0;
async function seedExpense(id: string, over: Partial<ExpenseFields>) {
  seq += 1;
  const e: FinanceEvent = {
    id: `seed-${seq}`,
    groupId: 'group-1',
    deviceSeq: seq,
    ts: seq,
    actor: { userId: 'u', deviceId: 'dev-other' },
    source: 'app',
    targetId: id,
    baseEventId: null,
    payload: {
      t: 'expense_created',
      fields: { amountSatang: 1000, date: '2026-09-01', stage: 'actual', categoryId: null, propertyId: null, item: '', note: '', payer: null, ...over },
    },
  };
  await mockFinance.append(e);
}

const SOMWANG = { id: 'p-somwang', name: 'อาจารย์สมหวัง' };

describe('v2 expense form (E11-S01, E11-S02 · D-82)', () => {
  beforeEach(() => {
    mockParams.current = { id: 'new' };
    mockRouter.replace.mockClear();
  });

  it('saves with only the amount (today, เกิดจริง); five category tiles, all nine one tap away', async () => {
    wrap(<ExpenseScreen />);
    await flush();
    // Simple design (owner 2026-10-23): five tiles + "อื่น ๆ · อีก N"; date, stage, farm, item, note behind "เพิ่มรายละเอียด".
    expect(screen.getAllByTestId(/^expense-cat-cat-[a-z-]+$/).filter((n) => !n.props.testID.endsWith('-check'))).toHaveLength(5);
    expect(screen.getByTestId('expense-cat-more')).toHaveTextContent(/อีก 4/);
    expect(screen.queryByTestId('expense-date')).toBeNull();
    // First time on this device: farm funds, and no "same as last time" (AC A).
    expect(screen.getByTestId('expense-payer-row')).toHaveTextContent(/เงินสวน/);
    expect(screen.getByTestId('expense-payer-row')).not.toHaveTextContent(/เหมือนครั้งก่อน/);
    expect(screen.getByTestId('expense-details')).toHaveTextContent(/เกิดจริง/);
    fireEvent.press(screen.getByTestId('expense-cat-more'));
    for (const id of ['fertilizer', 'labour', 'fuel', 'herbicide', 'travel', 'salary', 'worker-aid', 'repair', 'other']) {
      expect(screen.getByTestId(`expense-catall-cat-${id}`)).toBeTruthy();
    }
    // E01-S25 CT-12: everything outside the order and the payer is style F (owner answer ข); "+ เพิ่มหมวด" is a dashed add tile.
    for (const id of ['fertilizer', 'labour', 'other']) expectChoiceTile(screen.getByTestId(`expense-catall-cat-${id}`), 'check');
    expectChoiceTile(screen.getByTestId('expense-cat-add'), 'add');
    fireEvent.press(screen.getByTestId('expense-cat-sheet-scrim'));
    // Typed on the app's pad (E01-S20); the card reads it back as money with "บาท" inside.
    typeOnPad('expense-amount', '640');
    expect(screen.getByTestId('expense-amount')).toHaveTextContent(/640\.00\s*บาท/);
    fireEvent.press(screen.getByTestId('expense-details'));
    pickDate('expense-date', '2026-09-28');
    fireEvent.press(screen.getByTestId('expense-details-done'));
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();

    const s = await state();
    const x = s.expenses.find((e) => e.amountSatang === 64000);
    expect(x).toMatchObject({ amountSatang: 64000, date: '2026-09-28', stage: 'actual' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/v2/expenses');
  });

  it('the date · stage line under เพิ่มรายละเอียด wraps, never cut with "…" (owner rule 2026-10-27)', async () => {
    wrap(<ExpenseScreen />);
    await flush();
    const line = screen.getByTestId('expense-details-line');
    expect(line).toHaveTextContent(/เกิดจริง/);
    expect(line.props.numberOfLines).toBeUndefined();
  });

  it('the date · stage line has no "แตะเพื่อเปลี่ยน": the row already looks tappable (owner 2026-11-14)', async () => {
    wrap(<ExpenseScreen />);
    await flush();
    const line = screen.getByTestId('expense-details-line');
    expect(line).toHaveTextContent(/^\d{1,2} \S+ \d{4} · เกิดจริง$/);
    expect(line).not.toHaveTextContent(/แตะเพื่อเปลี่ยน|—/);
  });

  it('an actual or committed expense cannot be dated after today; a planned one can (E01-S22 Q3, owner "1 ก 2 ก")', async () => {
    const tomorrow = dayAfter(todayIso());
    wrap(<ExpenseScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('expense-details'));
    expect(dayCell('expense-date', tomorrow).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('expense-date-picker-done'));
    fireEvent.press(screen.getByTestId('expense-stage-committed'));
    expect(dayCell('expense-date', tomorrow).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('expense-date-picker-done'));
    fireEvent.press(screen.getByTestId('expense-stage-planned'));
    expect(dayCell('expense-date', tomorrow).props.accessibilityState.disabled).toBeFalsy();
  });

  it('a future date picked while planned, then switched to actual, asks for a new date on save and saves nothing', async () => {
    const before = (await state()).expenses.length;
    wrap(<ExpenseScreen />);
    await flush();
    typeOnPad('expense-amount', '50');
    fireEvent.press(screen.getByTestId('expense-details'));
    fireEvent.press(screen.getByTestId('expense-stage-planned'));
    pickDate('expense-date', dayAfter(todayIso()));
    fireEvent.press(screen.getByTestId('expense-stage-actual'));
    fireEvent.press(screen.getByTestId('expense-details-done'));
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();
    expect(screen.getByTestId('expense-date-row-error')).toHaveTextContent('วันที่ยังไม่ถึง เลือกวันใหม่');
    expect((await state()).expenses.length).toBe(before);
  });

  it('a salary row dated ahead (next month, its date not the user\'s to pick) still saves (review of PR 194 B1)', async () => {
    const month = todayIso().slice(0, 7);
    const [y, m] = month.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    seq += 1;
    await mockFinance.append({
      id: `seed-${seq}`, groupId: 'group-1', deviceSeq: seq, ts: seq, actor: { userId: 'u', deviceId: 'dev-other' }, source: 'app', targetId: 'salary-b1', baseEventId: null,
      payload: { t: 'salary_set', rule: { recipient: SOMWANG, payer: { id: FARM_FUNDS, name: '' }, amountSatang: 500000, startMonth: month, dueDay: 28 } },
    });
    mockParams.current = { id: `salary-b1:${next}` };
    mockRouter.replace.mockClear();
    wrap(<ExpenseScreen />);
    await flush();
    expect(screen.queryByTestId('expense-date')).toBeNull();
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();
    expect(screen.queryByTestId('expense-date-row-error')).toBeNull();
    expect(mockRouter.replace).toHaveBeenCalled();
  });

  it('refuses committed without an amount; planned may be "unknown"', async () => {
    wrap(<ExpenseScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('expense-details'));
    fireEvent.press(screen.getByTestId('expense-stage-committed'));
    fireEvent.press(screen.getByTestId('expense-details-done'));
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    expect(screen.getByTestId('expense-amount-error')).toBeTruthy();

    fireEvent.press(screen.getByTestId('expense-details'));
    fireEvent.press(screen.getByTestId('expense-stage-planned'));
    pickDate('expense-date', '2026-11-15');
    fireEvent.press(screen.getByTestId('expense-details-done'));
    // "ยังไม่ทราบจำนวนเงิน" turns on and off: an F tick tile (CT-3).
    expectChoiceTile(screen.getByTestId('expense-unknown'), 'checkbox');
    fireEvent.press(screen.getByTestId('expense-unknown'));
    expect(screen.getByTestId('expense-unknown').props.accessibilityState).toMatchObject({ checked: true });
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();
    const s = await state();
    expect(s.expenses.some((e) => e.stage === 'planned' && e.amountSatang === null && e.date === '2026-11-15')).toBe(true);
  });

  it('category sheet: tapping the category already picked closes the sheet again (review 6004800731 #1)', async () => {
    wrap(<ExpenseScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('expense-cat-more'));
    fireEvent.press(screen.getByTestId('expense-catall-cat-repair'));
    await flush();
    expect(screen.queryByTestId('expense-cat-sheet')).toBeNull();
    fireEvent.press(screen.getByTestId('expense-cat-more'));
    expect(screen.getByTestId('expense-catall-cat-repair').props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByTestId('expense-catall-cat-repair'));
    await flush();
    expect(screen.queryByTestId('expense-cat-sheet')).toBeNull();
    expect(screen.getByTestId('expense-cat-more')).toBeTruthy();
  });

  it('worker aid: the kind is F (pick one, switches at once), the worker is I (E01-S25 CT-6, CT-12)', async () => {
    wrap(<ExpenseScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('expense-cat-more'));
    fireEvent.press(screen.getByTestId('expense-catall-cat-worker-aid'));
    await flush();
    for (const k of ['accident', 'general', 'food', 'other']) expectChoiceTile(screen.getByTestId(`aid-kind-${k}`), 'check');
    fireEvent.press(screen.getByTestId('aid-kind-food'));
    fireEvent.press(screen.getByTestId('aid-kind-other'));
    expect(screen.getByTestId('aid-kind-other').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('aid-kind-food').props.accessibilityState).toMatchObject({ selected: false });
    expectChoiceTile(screen.getByTestId(`aid-worker-${FARM_FUNDS}`), 'mark');
    expectChoiceTile(screen.getByTestId('aid-worker-add'), 'add');
  });

  it('a payer other than farm funds previews what the farm will owe back', async () => {
    wrap(<ExpenseScreen />);
    await flush();
    typeOnPad('expense-amount', '400');
    // "ใครจ่ายไปก่อน" is one row; the choice opens in a sheet.
    expect(screen.getByTestId('expense-payer-row')).toHaveTextContent(/ใครจ่ายไปก่อน/);
    fireEvent.press(screen.getByTestId('expense-payer-row'));
    // E01-S25 CT-6: the payer is style I; "+ คนอื่น" is a dashed add tile.
    expectChoiceTile(screen.getByTestId(`expense-payer-${FARM_FUNDS}`), 'mark');
    expectChoiceTile(screen.getByTestId('expense-payer-add'), 'add');
    fireEvent.press(screen.getByTestId('expense-payer-add'));
    fireEvent.changeText(screen.getByTestId('expense-payer-name'), 'นัด');
    await act(async () => fireEvent.press(screen.getByTestId('expense-payer-add-save')));
    await flush();
    expect(screen.getByTestId('owed-preview')).toBeTruthy();
    expect(screen.getByText('400.00 บาท')).toBeTruthy();
    fireEvent.press(screen.getByTestId('expense-payer-done'));
    expect(screen.getByTestId('expense-payer-row')).toHaveTextContent(/นัด/);
  });

  it('"ใครจ่ายไปก่อน" opens as a full page, not a sheet; back keeps the pick (E01-S25 rv245-07, owner 2026-11-23)', async () => {
    wrap(<ExpenseScreen />);
    await flush();
    typeOnPad('expense-amount', '400');
    fireEvent.press(screen.getByTestId('expense-payer-row'));
    // A full page: its own header and back, the form underneath is gone (not dimmed behind a sheet).
    expect(screen.getByTestId('expense-payer-page')).toBeTruthy();
    expect(screen.queryByTestId('expense-payer-sheet')).toBeNull();
    expect(screen.queryByTestId('expense-payer-row')).toBeNull();
    expect(screen.queryByTestId('expense-amount')).toBeNull();
    expect(screen.getByTestId('expense-payer-back')).toBeTruthy();
    expect(screen.getAllByText('ใครจ่ายไปก่อน').length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId(`expense-payer-${FARM_FUNDS}`));
    fireEvent.press(screen.getByTestId('expense-payer-none'));
    fireEvent.press(screen.getByTestId('expense-payer-back'));
    // Back returns to the form with the pick kept and the amount still there.
    expect(screen.queryByTestId('expense-payer-page')).toBeNull();
    expect(screen.getByTestId('expense-payer-row')).toHaveTextContent(/ใส่ทีหลัง/);
    expect(screen.getByTestId('expense-amount')).toHaveTextContent(/400/);
    // ตกลง also returns to the form.
    fireEvent.press(screen.getByTestId('expense-payer-row'));
    fireEvent.press(screen.getByTestId('expense-payer-done'));
    expect(screen.getByTestId('expense-payer-row')).toBeTruthy();
  });

  it('a category picked under "อื่น ๆ" becomes a tile, ticked', async () => {
    wrap(<ExpenseScreen />);
    await flush();
    const hidden = ['salary', 'worker-aid', 'repair', 'other', 'travel', 'herbicide'].find((c) => !screen.queryByTestId(`expense-cat-cat-${c}`))!;
    fireEvent.press(screen.getByTestId('expense-cat-more'));
    fireEvent.press(screen.getByTestId(`expense-catall-cat-${hidden}`));
    expect(screen.getByTestId(`expense-cat-cat-${hidden}`).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId(`expense-cat-cat-${hidden}-check`)).toBeTruthy();
    expect(screen.getAllByTestId(/^expense-cat-cat-[a-z-]+$/).filter((n) => !n.props.testID.endsWith('-check'))).toHaveLength(5);
  });

  it('adds a category from the form', async () => {
    wrap(<ExpenseScreen />);
    await flush();
    // Category upkeep moved off the form: "จัดการหมวด" opens it in a sheet.
    fireEvent.press(screen.getByTestId('expense-cat-more'));
    fireEvent.press(screen.getByTestId('expense-cat-add'));
    fireEvent.changeText(screen.getByTestId('expense-cat-name'), 'ค่าไฟ');
    await act(async () => fireEvent.press(screen.getByTestId('expense-cat-save')));
    await flush();
    expect((await state()).categories.map((c) => c.name)).toContain('ค่าไฟ');
  });
});

describe('expense list (F4, F7)', () => {
  it('filters: four E boxes 2 by 2, two F ticks, clear is an underlined link (E01-S26 PS26-1)', async () => {
    await seedExpense('f-1', { amountSatang: 200000, date: '2026-09-20', stage: 'planned' });
    await seedExpense('f-2', { amountSatang: 150000, date: '2026-09-21' });
    wrap(<ExpensesScreen />);
    await flush();
    const flat = (st: unknown) => Object.assign({}, ...[st].flat(Infinity).filter(Boolean));
    for (const id of ['filter-stage', 'filter-category', 'filter-farm', 'filter-month']) {
      const box = flat(screen.getByTestId(id).props.style);
      expect(box.borderRadius).toBe(tokens.radius.md);
      expect(box.borderWidth).toBe(tokens.border.thick);
    }
    expect(screen.getByTestId('filter-stage')).toHaveTextContent(/วงจร.*ทั้งหมด/);
    for (const id of ['filter-payer-missing', 'filter-unrepaid']) expectChoiceTile(screen.getByTestId(id), 'checkbox');
    expect(screen.queryByTestId('filter-clear')).toBeNull();
    fireEvent.press(screen.getByTestId('filter-stage'));
    expectChoiceTile(screen.getByTestId('stage-planned'), 'check');
    fireEvent.press(screen.getByTestId('stage-planned'));
    expect(screen.getByTestId('filter-stage')).toHaveTextContent(/วางแผน/);
    expect(flat(screen.getByTestId('filter-stage').props.style).backgroundColor).toBe(tokens.color.light.actionSunk);
    expect(screen.queryByTestId('expense-f-2')).toBeNull();
    const clear = screen.getByTestId('filter-clear');
    expect(flat(clear.props.style).borderWidth ?? 0).toBe(0);
    fireEvent.press(clear);
    expect(screen.getByTestId('expense-f-2')).toBeTruthy();
  });

  it('bulk-sets the payer on expenses with none, and the farm then owes them', async () => {
    await seedExpense('bulk-1', { amountSatang: 200000, date: '2026-09-20' });
    await seedExpense('bulk-2', { amountSatang: 150000, date: '2026-09-20' });
    wrap(<ExpensesScreen />);
    await flush();

    fireEvent.press(screen.getByTestId('filter-payer-missing'));
    fireEvent.press(screen.getByTestId('expense-bulk-1'));
    fireEvent.press(screen.getByTestId('expense-bulk-2'));
    fireEvent.press(screen.getByTestId('bulk-payer-add'));
    fireEvent.changeText(screen.getByTestId('bulk-payer-name'), 'เจ้าของสวน');
    await act(async () => fireEvent.press(screen.getByTestId('bulk-payer-add-save')));
    await flush();
    expect(screen.getByTestId('bulk-owed')).toHaveTextContent(/3,500\.00/);
    await act(async () => fireEvent.press(screen.getByTestId('bulk-payer-save')));
    await flush();

    const s = await state();
    const owed = s.reimbursements.filter((r) => r.expenseId.startsWith('bulk-'));
    expect(owed.map((r) => r.originalSatang).sort()).toEqual([150000, 200000]);
    expect(owed.every((r) => r.to.name === 'เจ้าของสวน')).toBe(true);
  });

  it('the totals card shows short money with the unit stressed; rows keep the full amount (owner rule 2026-10-31)', async () => {
    await seedExpense('cm-a', { amountSatang: 10_300_000, date: '2025-03-05' });
    await seedExpense('cm-c', { amountSatang: 325_000, date: '2025-03-06', stage: 'committed' });
    await seedExpense('cm-p', { amountSatang: 1_254_000, date: '2025-03-07', stage: 'planned' });
    wrap(<ExpensesScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('filter-month'));
    fireEvent.press(screen.getByTestId('month-2025-03'));

    const totals = screen.getByTestId('totals');
    expect(totals).not.toHaveTextContent(/103,000\.00|3,250\.00|12,540\.00/);
    expect(screen.getByTestId('total-actual')).toHaveTextContent(/฿ 103\.0k$/);
    expect(screen.getByTestId('total-committed')).toHaveTextContent(/฿ 3,250$/);
    expect(screen.getByTestId('total-planned')).toHaveTextContent(/฿ 12\.54k$/);
    const unit = within(screen.getByTestId('total-actual')).getByText('k');
    expect(Object.assign({}, ...[unit.props.style].flat(Infinity).filter(Boolean)).color).toBe(tokens.color.light.action);
    // Screen readers still hear the exact figure.
    expect(within(totals).getByLabelText('103,000.00 บาท')).toBeTruthy();
    // A row is one item, not a summary: it keeps the full amount.
    expect(screen.getByTestId('expense-amount-cm-a')).toHaveTextContent('103,000.00');
  });
});

describe('expense list: shop orders (E11-S11 FO-12)', () => {
  const fert = (formula: string) => ({ type: 'chemical' as const, formula, brand: '', sackKg: null, reasons: [], zones: [], shop: 'ร้านสมศรี', orderedBy: '', sacks: 2, pricePerSackSatang: 50000, itemDiscountSatang: 0 });
  it('shows the items of one order as one row, opens the order, and keeps the totals per item', async () => {
    await seedExpense('ord-9-a', { amountSatang: 100000, date: '2026-10-20', stage: 'committed', categoryId: 'cat-fertilizer', orderId: 'ord-9', fertilizer: fert('ยูเรีย') });
    await seedExpense('ord-9-b', { amountSatang: 50000, date: '2026-10-20', stage: 'committed', categoryId: 'cat-fertilizer', orderId: 'ord-9', fertilizer: fert('15-15-15') });
    wrap(<ExpensesScreen />);
    await flush();
    expect(screen.queryByTestId('expense-ord-9-a')).toBeNull();
    const row = screen.getByTestId('order-ord-9');
    expect(row).toHaveTextContent(/ปุ๋ย 2 รายการ/);
    expect(row).toHaveTextContent(/ร้านสมศรี/);
    expect(row).toHaveTextContent(/สั่งไว้/);
    // E11-S17: nothing is "told" on an order any more, so no progress chip.
    expect(screen.queryByTestId('order-progress-ord-9')).toBeNull();
    expect(screen.getByTestId('order-amount-ord-9')).toHaveTextContent(/1,500\.00/);
    fireEvent.press(row);
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/v2/order/[orderId]', params: { orderId: 'ord-9' } });
    // Picking a payer works per item, not per order.
    fireEvent.press(screen.getByTestId('filter-payer-missing'));
    expect(screen.getByTestId('expense-ord-9-a')).toBeTruthy();
    expect(screen.getByTestId('expense-ord-9-b')).toBeTruthy();
  });

  it('a legacy fertilizer expense (no orderId) opens as an order of its own id', async () => {
    await seedExpense('legacy-f', { amountSatang: 80000, date: '2026-09-02', categoryId: 'cat-fertilizer', fertilizer: fert('ยูเรีย') });
    wrap(<ExpensesScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('expense-legacy-f'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/v2/order/[orderId]', params: { orderId: 'legacy-f' } });
  });
});

describe('repayment (E11-S03)', () => {
  beforeAll(async () => {
    await seedExpense('rp-a', { amountSatang: 80000, date: '2026-09-15', payer: SOMWANG });
    await seedExpense('rp-b', { amountSatang: 40000, date: '2026-09-22', payer: SOMWANG });
  });

  it('the repayment date is picked from a calendar, not typed (E01-S22 DP-1)', async () => {
    mockParams.current = { payerId: SOMWANG.id };
    wrap(<RepayScreen />);
    await flush();
    expect(screen.getByTestId('repay-date').props.accessibilityRole).toBe('button');
    pickDate('repay-date', '2026-09-28');
    expect(screen.getByTestId('repay-date-value')).toHaveTextContent('28 ก.ย. 2569');
  });

  it('a repayment cannot be dated after today (E01-S22 Q1 ก)', async () => {
    mockParams.current = { payerId: SOMWANG.id };
    wrap(<RepayScreen />);
    await flush();
    expect(dayCell('repay-date', dayAfter(todayIso())).props.accessibilityState.disabled).toBe(true);
  });

  it('who repays whom: two full-width picker rows with their labels shown, ›, and names that wrap (E01-S21 PK-1)', async () => {
    mockParams.current = { payerId: SOMWANG.id };
    wrap(<RepayScreen />);
    await flush();
    for (const [id, label] of [['repay-from', 'ผู้คืน'], ['repay-to', 'ผู้รับ']] as const) {
      const row = screen.getByTestId(id);
      expect(within(row).getByText(label)).toBeTruthy();
      expect(within(row).getByTestId(`${id}-chevron`, { includeHiddenElements: true })).toBeTruthy();
      expect(within(row).getByTestId(`${id}-name`).props.numberOfLines).toBeUndefined();
    }
  });

  it('who repays whom has no "แตะเพื่อเปลี่ยน" hint: the two boxes already look tappable (owner 2026-11-14)', async () => {
    mockParams.current = { payerId: SOMWANG.id };
    wrap(<RepayScreen />);
    await flush();
    expect(screen.getByTestId('repay-from')).toBeTruthy();
    expect(screen.queryByText(/แตะเพื่อเปลี่ยน/)).toBeNull();
  });

  it('refuses more than is owed', async () => {
    mockParams.current = { payerId: SOMWANG.id };
    wrap(<RepayScreen />);
    await flush();
    // On the pad (E01-S20 NP-5) ตกลง stays off with the reason; the page keeps its own gate too.
    fireEvent.press(screen.getByTestId('repay-amount'));
    for (const k of '1300') fireEvent.press(screen.getByTestId(`repay-amount-pad-key-${k}`));
    expect(screen.getByTestId('repay-amount-done').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('repay-amount-sheet')).toHaveTextContent(/คืนเกินยอด คืนได้ไม่เกิน 1,200\.00/);
  });

  it('one amount over two debts, oldest first, from farm funds by default', async () => {
    mockParams.current = { payerId: SOMWANG.id };
    wrap(<RepayScreen />);
    await flush();
    typeOnPad('repay-amount', '1000');
    await act(async () => fireEvent.press(screen.getByTestId('repay-save')));
    await flush();

    const s = await state();
    const a = s.reimbursements.find((r) => r.expenseId === 'rp-a');
    const b = s.reimbursements.find((r) => r.expenseId === 'rp-b');
    expect(a).toMatchObject({ remainingSatang: 0, status: 'repaid' });
    expect(b).toMatchObject({ remainingSatang: 20000, status: 'partial' });
    expect(s.repayments[s.repayments.length - 1].from.id).toBe('farm');
  });

  it('the owed page totals what is left per person', async () => {
    wrap(<OwedScreen />);
    await flush();
    expect(screen.getByTestId(`owed-amount-${SOMWANG.id}`).props.children).toBe('200.00');
  });

  it('"ลบการคืน" is a red underlined link under บันทึกการคืน, left-aligned, not a round button at the line end (owner 2026-11-07)', async () => {
    wrap(<OwedScreen />);
    await flush();
    fireEvent.press(screen.getByTestId(`owed-open-${SOMWANG.id}`));
    const card = screen.getByTestId(`owed-${SOMWANG.id}`);
    const order = card.findAll((n) => typeof n.props.testID === 'string' && n.props.accessibilityRole === 'button' && /^(owed-repay-|repayment-void-)/.test(n.props.testID)).map((n) => n.props.testID as string);
    const ids = [...new Set(order)];
    expect(ids[0]).toBe(`owed-repay-${SOMWANG.id}`);
    expect(ids.slice(1).every((x) => x.startsWith('repayment-void-'))).toBe(true);
    expect(ids.length).toBeGreaterThan(1);
    const link = screen.getAllByTestId(/^repayment-void-/)[0];
    const flat = (st: unknown) => Object.assign({}, ...[st].flat(Infinity).filter(Boolean));
    expect(flat(link.props.style)).toMatchObject({ alignSelf: 'flex-start' });
    expect(flat(link.props.style).borderWidth ?? 0).toBe(0);
    expect(flat(within(link).getByText(/ลบการคืน/).props.style)).toMatchObject({ textDecorationLine: 'underline', color: tokens.color.light.reject });
  });
});

describe('"ลบการคืน" links: one per repayment, named when there are several (owner 2026-11-07)', () => {
  const NOK = { id: 'p-nok', name: 'นก' };
  const repay = async (amount: string) => {
    mockParams.current = { payerId: NOK.id };
    wrap(<RepayScreen />);
    await flush();
    typeOnPad('repay-amount', amount);
    await act(async () => fireEvent.press(screen.getByTestId('repay-save')));
    await flush();
    screen.unmount();
  };
  beforeAll(async () => {
    await seedExpense('nk-a', { amountSatang: 30000, date: '2026-09-15', payer: NOK });
    await seedExpense('nk-b', { amountSatang: 20000, date: '2026-09-22', payer: NOK });
  });

  it('a repayment over two items is one link; two repayments are named by amount', async () => {
    await repay('400'); // 300 to nk-a, 100 to nk-b
    await repay('50');
    wrap(<OwedScreen />);
    await flush();
    fireEvent.press(screen.getByTestId(`owed-open-${NOK.id}`));
    const links = screen.getAllByTestId(/^repayment-void-/);
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent(/^ลบการคืน 400\.00 · /);
    expect(links[1]).toHaveTextContent(/^ลบการคืน 50\.00 · /);
    expect(screen.getByTestId(`owed-repay-${NOK.id}`)).toBeTruthy();
    screen.unmount();
  });

  it('fully repaid: no บันทึกการคืน, the links stay so a repayment can still be deleted', async () => {
    await repay('50');
    wrap(<OwedScreen />);
    await flush();
    fireEvent.press(screen.getByTestId(`owed-open-${NOK.id}`));
    expect(screen.queryByTestId(`owed-repay-${NOK.id}`)).toBeNull();
    expect(screen.getAllByTestId(/^repayment-void-/)).toHaveLength(3);
  });
});

describe('Save placement', () => {
  it('expense-save is pinned at the bottom in the simple design (owner 2026-10-23), not in the header', async () => {
    mockParams.current = { id: 'new' };
    wrap(<ExpenseScreen />);
    await flush();
    expect(within(screen.getByTestId('screen-header')).queryByTestId('expense-save')).toBeNull();
    expect(within(screen.getByTestId('expense-actions')).getByTestId('expense-save')).toBeTruthy();
  });

  it('repay-save sits in the bottom save bar (owner 2026-11-07, style I) and keeps its total while saving', async () => {
    mockParams.current = { payerId: SOMWANG.id };
    wrap(<RepayScreen />);
    await flush();
    typeOnPad('repay-amount', '100');
    expect(within(screen.getByTestId('screen-header')).queryByTestId('repay-save')).toBeNull();
    const btn = within(screen.getByTestId('save-bar')).getByTestId('repay-save');
    expect(btn.props.accessibilityLabel).toContain('100.00');
  });
});
