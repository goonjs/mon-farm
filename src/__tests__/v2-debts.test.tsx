import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { tokens } from '../../design/tokens';
import type { ReactNode } from 'react';

import { AddDebtScreen, PayDebtScreen as DebtPaymentScreen } from '../v2/money/debt-forms';
import { DebtAccountScreen } from '../v2/money/debts-screens';
import { projectDebts } from '../core/finance/debts';
import { projectFinance } from '../core/finance/ledger';
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
const { __params: mockParams, router: mockRouter } = jest.requireMock('expo-router') as {
  __params: { current: Record<string, string> };
  router: { push: jest.Mock; replace: jest.Mock };
};

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const DAENG = { workerId: 'p-daeng', name: 'แดง' };

describe('debt ledger (E06-S03)', () => {
  beforeEach(() => {
    mockParams.current = DAENG;
  });

  it('kind fertilizer opens the shop order (E11-S11)', async () => {
    wrap(<AddDebtScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('debt-kind-fertilizer'));
    // Replaced: after saving the purchase the user lands on the tapper's debts, not this form again.
    expect(mockRouter.replace).toHaveBeenCalledWith('/v2/order');
    expect(screen.queryByTestId('debt-pct-mode')).toBeNull();
  });

  it('an old manual fertilizer debt (bill × %) still reads, with its owner-share expense', async () => {
    await mockFinance.append({
      id: 'old-fert-1',
      groupId: 'group-1',
      deviceSeq: 1,
      ts: 1,
      actor: { userId: 'u', deviceId: 'dev-old' },
      source: 'app',
      targetId: 'debt-old-fert',
      baseEventId: null,
      payload: {
        t: 'debt_added',
        fields: { worker: { id: 'p-daeng', name: 'แดง' }, kind: 'fertilizer', amountSatang: 200000, date: '2026-09-20', note: 'ปุ๋ยรอบ ก.ย.', lender: null, fertilizer: { totalSatang: 400000, workerPct: 50 }, carriedForward: false },
      },
    });
    const events = await mockFinance.load();
    expect(projectDebts(events).get('p-daeng')?.summary.owed.fertilizer).toBe(200000);
    const owner = projectFinance(events).expenses.find((x) => x.id.endsWith(':owner'));
    expect(owner).toMatchObject({ amountSatang: 200000, categoryId: 'cat-fertilizer', payer: null });
  });

  it('"other" needs a note', async () => {
    wrap(<AddDebtScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('debt-kind-other'));
    fireEvent.press(screen.getByTestId('debt-amount'));
    for (const k of '100') fireEvent.press(screen.getByTestId(`debt-amount-pad-key-${k}`));
    fireEvent.press(screen.getByTestId('debt-amount-done'));
    await act(async () => fireEvent.press(screen.getByTestId('debt-save')));
    expect(screen.getByTestId('debt-note-error')).toBeTruthy();
  });

  it('paying more than owed warns, then "save anyway" records it and flags the account', async () => {
    wrap(<DebtPaymentScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('debt-pay-amount'));
    for (const k of '2500') fireEvent.press(screen.getByTestId(`debt-pay-amount-pad-key-${k}`));
    fireEvent.press(screen.getByTestId('debt-pay-amount-done'));
    await act(async () => fireEvent.press(screen.getByTestId('debt-pay-save')));
    expect(screen.getByTestId('debt-pay-over')).toBeTruthy();
    // while the over-pay question is open, its own two buttons decide: no Save bar
    expect(screen.queryByTestId('save-bar')).toBeNull();
    await act(async () => fireEvent.press(screen.getByTestId('debt-pay-anyway')));
    await flush();
    const a = projectDebts(await mockFinance.load()).get('p-daeng');
    expect(a).toMatchObject({ balanceSatang: -50000, overpaid: true });
  });

  it('account: reconciliation bottom line equals the balance; history filters by kind; void recomputes', async () => {
    wrap(<DebtAccountScreen />);
    await flush();
    expect(screen.getByTestId('debt-balance').props.children).toBe('500.00');
    expect(screen.getByTestId('debt-summary-balance').props.children).toBe('−500.00');
    expect(screen.getByTestId('debt-flag')).toBeTruthy();

    fireEvent.press(screen.getByTestId('debt-filter-payment'));
    const payment = screen.getAllByTestId(/^debt-line-/);
    expect(payment).toHaveLength(1);
    const id = payment[0].props.testID.replace('debt-line-', '');
    // Owner 2026-11-07: void is a red underlined link (style F); restore a blue one (style B) — no round buttons.
    const flat = (st: unknown) => Object.assign({}, ...[st].flat(Infinity).filter(Boolean));
    expect(flat(within(screen.getByTestId(`debt-void-${id}`)).getByText('ยกเลิก').props.style)).toMatchObject({ textDecorationLine: 'underline', color: tokens.color.light.reject });
    expect(flat(screen.getByTestId(`debt-void-${id}`).props.style).borderWidth ?? 0).toBe(0);
    await act(async () => fireEvent.press(screen.getByTestId(`debt-void-${id}`)));
    await flush();
    expect(projectDebts(await mockFinance.load()).get('p-daeng')?.balanceSatang).toBe(200000);
    expect(flat(within(screen.getByTestId(`debt-void-${id}`)).getByText('กู้คืน').props.style)).toMatchObject({ textDecorationLine: 'underline', color: tokens.color.light.action });
  });
});

describe('a debt made from an expense share (E11-S10)', () => {
  it('cannot be voided here: it opens its expense (a shared expense of another category, E11-S10 B)', async () => {
    mockParams.current = { workerId: 'p-som', name: 'สม' };
    await mockFinance.append({
      id: 'share-exp-1',
      groupId: 'group-1',
      deviceSeq: 9,
      ts: 9,
      actor: { userId: 'u', deviceId: 'dev-old' },
      source: 'app',
      targetId: 'exp-share-1',
      baseEventId: null,
      payload: {
        t: 'expense_created',
        fields: {
          amountSatang: 100000, date: '2026-10-01', stage: 'actual', categoryId: 'cat-other', propertyId: null, item: 'ยาฆ่าหญ้า', note: '', payer: null,
          share: { billSatang: 100000, discountSatang: 0, totalSacks: 2, lines: [{ worker: { id: 'p-som', name: 'สม' }, sacks: 2, workerPct: 50, settle: 'debt' }] },
        },
      },
    });
    wrap(<DebtAccountScreen />);
    await flush();
    const id = 'exp-share-1:share:p-som';
    expect(screen.getByTestId(`debt-line-${id}`)).toBeTruthy();
    expect(screen.queryByTestId(`debt-void-${id}`)).toBeNull();
    // Owner 2026-11-07 (style A): the line itself opens the expense, a chevron on the right, no round button.
    const open = screen.getByTestId(`debt-open-${id}`);
    expect(within(open).getByTestId(`debt-open-${id}-chevron`, { includeHiddenElements: true })).toBeTruthy();
    expect(within(open).queryByText('เปิดรายการค่าใช้จ่าย')).toBeNull();
    expect(open.props.accessibilityLabel).toMatch(/^เปิดรายการค่าใช้จ่าย, .*, \+500\.00, /); // what the line says is read too
    fireEvent.press(open);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/v2/order/[orderId]', params: { orderId: 'exp-share-1' } });
  });

  it('once its purchase is deleted, the line opens the expense form, where it can be restored', async () => {
    mockParams.current = { workerId: 'p-som', name: 'สม' };
    await mockFinance.append({
      id: 'share-exp-1-del',
      groupId: 'group-1',
      deviceSeq: 10,
      ts: 10,
      actor: { userId: 'u', deviceId: 'dev-old' },
      source: 'app',
      targetId: 'exp-share-1',
      baseEventId: 'share-exp-1',
      payload: { t: 'expense_changed', patch: { deleted: true } },
    });
    wrap(<DebtAccountScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('debt-open-exp-share-1:share:p-som'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/v2/expense/[id]', params: { id: 'exp-share-1' } });
  });
});

describe('a fertilizing lump in the history (E16-S03 SP-8, SP-9; E11-S17 RM-6)', () => {
  const ev = (id: string, seq: number, targetId: string, payload: Parameters<typeof mockFinance.append>[0]['payload']) =>
    mockFinance.append({ id, groupId: 'group-1', deviceSeq: seq, ts: seq, actor: { userId: 'u', deviceId: 'dev-fz' }, source: 'app', targetId, baseEventId: null, payload });

  it('reads "ใส่ปุ๋ย {date}" with what was taken, says how much is left, and opens the fertilizing', async () => {
    mockParams.current = { workerId: 'p-kaew', name: 'แก้ว' };
    const kaew = { id: 'p-kaew', name: 'แก้ว' };
    await ev('fz-item', 1, 'ord-z-a', {
      t: 'expense_created',
      fields: {
        amountSatang: 300000, date: '2026-10-05', stage: 'actual', categoryId: 'cat-fertilizer', propertyId: null, item: 'ดีเกลือ', note: '', payer: null, orderId: 'ord-z',
        line: { qty: 10, unit: 'กระสอบ', grossSatang: 300000, itemDiscountSatang: 0 },
        fertilizer: { type: 'chemical', formula: 'ดีเกลือ', brand: '', sackKg: 50, reasons: [], zones: [], shop: '', orderedBy: '', sacks: 10 },
      },
    });
    await ev('fz-rec', 2, 'fz-k1', {
      t: 'fertilizing_recorded',
      fields: { date: '2026-10-20', lines: [{ sources: ['ord-z-a'], sacks: 10, takes: [{ worker: kaew, sacks: 4, auto: false }], rest: 'farm' }], pct: { 'p-kaew': 50 }, settle: {}, zones: [], reasons: [], note: '' },
    });
    await ev('fz-pay', 3, 'pay-k1', { t: 'debt_payment_recorded', fields: { worker: kaew, creditor: { id: 'farm', name: '' }, amountSatang: 20000, date: '2026-10-25', note: '', method: 'buyer-split', saleId: 'sale-9' } });
    wrap(<DebtAccountScreen />);
    await flush();
    const id = 'fz-k1:p-kaew';
    const line = screen.getByTestId(`debt-line-${id}`);
    expect(line).toHaveTextContent(/ใส่ปุ๋ย 20 ต\.ค\./);
    expect(line).toHaveTextContent(/ดีเกลือ 4 ถุง/);
    // 4 × 300 = 1,200 at 50% = 600; 200 deducted → 400 left
    expect(screen.getByTestId(`debt-left-${id}`)).toHaveTextContent(/เหลือ ฿\s?400/);
    fireEvent.press(screen.getByTestId(`debt-open-${id}`));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/v2/fertilizing', params: { id: 'fz-k1' } });
  });

  it('a lump deducted in full says "หักหมดแล้ว"', async () => {
    mockParams.current = { workerId: 'p-kaew', name: 'แก้ว' };
    await ev('fz-pay2', 4, 'pay-k2', { t: 'debt_payment_recorded', fields: { worker: { id: 'p-kaew', name: 'แก้ว' }, creditor: { id: 'farm', name: '' }, amountSatang: 40000, date: '2026-10-26', note: '', method: 'buyer-split', saleId: 'sale-10' } });
    wrap(<DebtAccountScreen />);
    await flush();
    expect(screen.getByTestId('debt-left-fz-k1:p-kaew')).toHaveTextContent('หักหมดแล้ว');
  });
});

describe('Save is pinned at the bottom, full width (owner 2026-11-07, style I)', () => {
  it('debt-save and debt-pay-save sit in the bottom save bar, not the header', async () => {
    wrap(<AddDebtScreen />);
    await flush();
    expect(within(screen.getByTestId('screen-header')).queryByTestId('debt-save')).toBeNull();
    expect(within(screen.getByTestId('save-bar')).getByTestId('debt-save')).toBeTruthy();
    screen.unmount();
    wrap(<DebtPaymentScreen />);
    await flush();
    expect(within(screen.getByTestId('save-bar')).getByTestId('debt-pay-save')).toBeTruthy();
  });
});
