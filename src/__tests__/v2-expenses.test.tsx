import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ExpenseFormScreen as ExpenseScreen } from '../v2/money/expense-form-screen';
import { ExpensesScreen } from '../v2/money/expenses-screen';
import { OwedScreen } from '../v2/money/owed-screen';
import { RepayScreen } from '../v2/money/repay-screen';
import { projectFinance } from '../core/finance/ledger';
import type { ExpenseFields, FinanceEvent } from '../core/finance/types';
import { financeStore as mockFinance } from '../store/finance';
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
    fireEvent.press(screen.getByTestId('expense-cat-sheet-scrim'));
    fireEvent.changeText(screen.getByTestId('expense-amount'), '640');
    // Formatted on leaving the box; "บาท" sits inside it.
    fireEvent(screen.getByTestId('expense-amount'), 'blur');
    expect(screen.getByTestId('expense-amount').props.value).toBe('640.00');
    expect(screen.getByTestId('expense-amount-box')).toHaveTextContent('บาท');
    fireEvent.press(screen.getByTestId('expense-details'));
    fireEvent.changeText(screen.getByTestId('expense-date'), '2026-09-28');
    fireEvent.press(screen.getByTestId('expense-details-done'));
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();

    const s = await state();
    const x = s.expenses.find((e) => e.amountSatang === 64000);
    expect(x).toMatchObject({ amountSatang: 64000, date: '2026-09-28', stage: 'actual' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/v2/expenses');
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
    fireEvent.changeText(screen.getByTestId('expense-date'), '2026-11-15');
    fireEvent.press(screen.getByTestId('expense-details-done'));
    fireEvent.press(screen.getByTestId('expense-unknown'));
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();
    const s = await state();
    expect(s.expenses.some((e) => e.stage === 'planned' && e.amountSatang === null && e.date === '2026-11-15')).toBe(true);
  });

  it('a payer other than farm funds previews what the farm will owe back', async () => {
    wrap(<ExpenseScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('expense-amount'), '400');
    // "ใครจ่ายไปก่อน" is one row; the choice opens in a sheet.
    expect(screen.getByTestId('expense-payer-row')).toHaveTextContent(/ใครจ่ายไปก่อน/);
    fireEvent.press(screen.getByTestId('expense-payer-row'));
    fireEvent.press(screen.getByTestId('expense-payer-add'));
    fireEvent.changeText(screen.getByTestId('expense-payer-name'), 'นัด');
    await act(async () => fireEvent.press(screen.getByTestId('expense-payer-add-save')));
    await flush();
    expect(screen.getByTestId('owed-preview')).toBeTruthy();
    expect(screen.getByText('400.00 บาท')).toBeTruthy();
    fireEvent.press(screen.getByTestId('expense-payer-done'));
    expect(screen.getByTestId('expense-payer-row')).toHaveTextContent(/นัด/);
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
    expect(screen.getByTestId('order-progress-ord-9')).toHaveTextContent(/บอกรายละเอียดแล้ว 0 \/ 2/);
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

  it('refuses more than is owed', async () => {
    mockParams.current = { payerId: SOMWANG.id };
    wrap(<RepayScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('repay-amount'), '1300');
    expect(screen.getByTestId('repay-amount-error')).toBeTruthy();
  });

  it('one amount over two debts, oldest first, from farm funds by default', async () => {
    mockParams.current = { payerId: SOMWANG.id };
    wrap(<RepayScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('repay-amount'), '1000');
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
});

describe('Save sits in the header (keyboard never covers it)', () => {
  it('expense-save is pinned at the bottom in the simple design (owner 2026-10-23), not in the header', async () => {
    mockParams.current = { id: 'new' };
    wrap(<ExpenseScreen />);
    await flush();
    expect(within(screen.getByTestId('screen-header')).queryByTestId('expense-save')).toBeNull();
    expect(within(screen.getByTestId('expense-actions')).getByTestId('expense-save')).toBeTruthy();
  });

  it('repay-save renders inside screen-header and keeps its total while saving', async () => {
    mockParams.current = { payerId: SOMWANG.id };
    wrap(<RepayScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('repay-amount'), '100');
    const btn = within(screen.getByTestId('screen-header')).getByTestId('repay-save');
    expect(btn.props.accessibilityLabel).toContain('100.00');
  });
});
