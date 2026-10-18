import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { projectDebts } from '../core/finance/debts';
import { projectFinance } from '../core/finance/ledger';
import type { FinanceEvent } from '../core/finance/types';
import { ExpenseFormScreen } from '../v2/money/expense-form-screen';
import { financeStore as mockFinance } from '../store/finance';
import { peopleStore as mockPeople } from '../store/people';
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
  router: { push: jest.Mock; replace: jest.Mock };
};

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

let seq = 0;
async function seed(targetId: string, payload: FinanceEvent['payload'], base: string | null = null) {
  seq += 1;
  const id = `seed-${String(seq).padStart(3, '0')}`;
  await mockFinance.append({
    id,
    groupId: 'group-1',
    deviceSeq: seq,
    ts: seq,
    actor: { userId: 'u', deviceId: 'dev-other' },
    source: 'app',
    targetId,
    baseEventId: base,
    payload,
  });
  return id;
}

describe('share an expense with a tapper (E11-S10 B)', () => {
  let daengId = '';
  beforeAll(async () => {
    daengId = (await mockPeople.create('แดง', ['tapper'])).id;
    await seed('cat-repair', { t: 'category_share_set', workerPct: 50 });
  });
  beforeEach(() => {
    mockParams.current = { id: 'new' };
  });

  it('a category without sharing shows no share row', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('expense-cat-cat-labour'));
    expect(screen.queryByTestId('share-row')).toBeNull();
  });

  it('discount first, then the tapper: the debt is half the net bill, odd satang to the tapper', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('expense-amount'), '1250.25');
    fireEvent.press(screen.getByTestId('expense-cat-cat-repair'));
    fireEvent.press(screen.getByTestId('share-row'));
    await flush();
    // The discount switch is off by default and sits above the tapper choice.
    expect(screen.queryByTestId('share-discount')).toBeNull();
    fireEvent.press(screen.getByTestId('share-discount-switch'));
    fireEvent.changeText(screen.getByTestId('share-discount'), '100');
    fireEvent.press(screen.getByTestId(`share-worker-${daengId}`));
    expect(screen.getByTestId('share-pct').props.value).toBe('50');
    expect(screen.getByTestId('share-preview')).toHaveTextContent(/575\.13.*575\.12/);
    fireEvent.press(screen.getByTestId('share-done'));
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();

    const events = await mockFinance.load();
    const x = projectFinance(events).expenses.find((e) => e.share);
    expect(x).toMatchObject({ amountSatang: 115_025, share: { billSatang: 125_025, discountSatang: 10_000, totalSacks: null } });
    expect(projectDebts(events).get(daengId)?.balanceSatang).toBe(57_513);
  });

  it('“จ่ายแล้ว” records the share with no debt', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('expense-amount'), '200');
    fireEvent.press(screen.getByTestId('expense-cat-cat-repair'));
    fireEvent.press(screen.getByTestId('share-row'));
    await flush();
    fireEvent.press(screen.getByTestId(`share-worker-${daengId}`));
    fireEvent.press(screen.getByTestId('share-settle-paid'));
    fireEvent.press(screen.getByTestId('share-done'));
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();
    const events = await mockFinance.load();
    const x = projectFinance(events).expenses.find((e) => e.amountSatang === 20_000);
    expect(x?.share?.lines[0].settle).toBe('paid');
    expect(projectDebts(events).get(daengId)?.balanceSatang).toBe(57_513);
  });

  it('category settings turn sharing on with a %', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('expense-cat-cat-herbicide'));
    fireEvent.press(screen.getByTestId('expense-cat-share'));
    fireEvent.press(screen.getByTestId('cat-share-switch'));
    fireEvent.changeText(screen.getByTestId('cat-share-pct'), '30');
    await act(async () => fireEvent.press(screen.getByTestId('cat-share-save')));
    await flush();
    expect(projectFinance(await mockFinance.load()).categories.find((c) => c.id === 'cat-herbicide')?.workerPct).toBe(30);
    expect(screen.getByTestId('share-row')).toBeTruthy();
  });

  it('the fertilizer category opens the fertilizer purchase flow with what was typed', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('expense-amount'), '10000');
    fireEvent.press(screen.getByTestId('expense-cat-cat-fertilizer'));
    // Replaced, not pushed: after saving the flow the half-filled form is not waiting underneath.
    expect(mockRouter.replace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/v2/fertilizer', params: expect.objectContaining({ bill: '10000', stage: 'actual', payerId: expect.any(String) }) }));
  });

  it('a fertilizer purchase opens in its own flow to be edited', async () => {
    await seed('exp-fert-1', {
      t: 'expense_created',
      fields: {
        amountSatang: 100_000, date: '2026-10-01', stage: 'actual', categoryId: 'cat-fertilizer', propertyId: null, item: 'ยูเรีย', note: '', payer: null,
        share: { billSatang: 100_000, discountSatang: 0, totalSacks: 1, lines: [] },
        fertilizer: { type: 'chemical', formula: 'ยูเรีย', brand: '', sackKg: null, reasons: [], zones: [], shop: '', orderedBy: '' },
      },
    });
    mockParams.current = { id: 'exp-fert-1' };
    wrap(<ExpenseFormScreen />);
    await flush();
    // Locked like a derived expense: saving here would drop the share (review 2026-10-18).
    expect(screen.queryByTestId('expense-save')).toBeNull();
    expect(screen.queryByTestId('expense-amount')).toBeNull();
    expect(screen.queryByTestId('share-row')).toBeNull();
    expect(screen.getByTestId('fert-locked')).toHaveTextContent(/1,000\.00/);
    fireEvent.press(screen.getByTestId('expense-open-fert'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/v2/fertilizer', params: { id: 'exp-fert-1' } });
  });

  it('an empty % is refused, never saved as 0', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('expense-amount'), '100');
    fireEvent.press(screen.getByTestId('expense-cat-cat-repair'));
    fireEvent.press(screen.getByTestId('share-row'));
    await flush();
    fireEvent.press(screen.getByTestId(`share-worker-${daengId}`));
    fireEvent.changeText(screen.getByTestId('share-pct'), '');
    expect(screen.getByTestId('share-pct-error')).toBeTruthy();
  });

  it('the net line reads bill − discount = net', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('expense-amount'), '1000');
    fireEvent.press(screen.getByTestId('expense-cat-cat-repair'));
    fireEvent.press(screen.getByTestId('share-row'));
    await flush();
    fireEvent.press(screen.getByTestId('share-discount-switch'));
    fireEvent.changeText(screen.getByTestId('share-discount'), '100');
    expect(screen.getByTestId('share-net')).toHaveTextContent('ยอดบิล 1,000.00 − ส่วนลด = ยอดสุทธิ 900.00');
  });

  const shared = (bill: number, discount: number, pct = 50) => ({
    t: 'expense_created' as const,
    fields: {
      amountSatang: bill - discount, date: '2026-10-02', stage: 'actual' as const, categoryId: 'cat-labour', propertyId: null, item: '', note: '', payer: { id: 'farm', name: 'เงินสวน' },
      share: { billSatang: bill, discountSatang: discount, totalSacks: null, lines: [{ worker: { id: daengId, name: 'แดง' }, sacks: null, workerPct: pct, settle: 'debt' as const }] },
    },
  });

  it('a share stays editable after its category stops sharing; saving unchanged writes nothing', async () => {
    await seed('exp-kept', shared(100_000, 10_000));
    mockParams.current = { id: 'exp-kept' };
    wrap(<ExpenseFormScreen />);
    await flush();
    expect(screen.getByTestId('share-row')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();
    expect((await mockFinance.load()).some((e) => e.targetId === 'exp-kept' && e.payload.t === 'expense_changed')).toBe(false);
  });

  it('removing the tapper on purpose keeps the discount: the amount stays the net', async () => {
    await seed('exp-unshare', shared(100_000, 10_000));
    mockParams.current = { id: 'exp-unshare' };
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('share-row'));
    await flush();
    fireEvent.press(screen.getByTestId('share-worker-none'));
    fireEvent.press(screen.getByTestId('share-done'));
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();
    const x = projectFinance(await mockFinance.load()).expenses.find((e) => e.id === 'exp-unshare');
    expect(x).toMatchObject({ amountSatang: 90_000, share: null });
  });

  it('a share edit always writes the net amount with it', async () => {
    await seed('exp-pair', shared(100_000, 0));
    mockParams.current = { id: 'exp-pair' };
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('share-row'));
    await flush();
    fireEvent.changeText(screen.getByTestId('share-pct'), '30');
    fireEvent.press(screen.getByTestId('share-done'));
    await act(async () => fireEvent.press(screen.getByTestId('expense-save')));
    await flush();
    const change = (await mockFinance.load()).find((e) => e.targetId === 'exp-pair' && e.payload.t === 'expense_changed');
    expect(Object.keys((change!.payload as { patch: object }).patch).sort()).toEqual(['amountSatang', 'share']);
  });

  it('two devices change the share: one conflict card that reads the share; picking writes the matching net', async () => {
    const head = await seed('exp-two', shared(100_000, 0));
    const a = shared(100_000, 20_000).fields;
    const b = shared(100_000, 0, 30).fields;
    await seed('exp-two', { t: 'expense_changed', patch: { share: a.share, amountSatang: a.amountSatang } }, head);
    await seed('exp-two', { t: 'expense_changed', patch: { share: b.share, amountSatang: b.amountSatang } }, head);
    mockParams.current = { id: 'exp-two' };
    wrap(<ExpenseFormScreen />);
    await flush();
    expect(screen.queryByTestId('conflict-amountSatang')).toBeNull();
    expect(screen.getByTestId('conflict-share')).toHaveTextContent(/แชร์กับคนกรีดยาง/);
    expect(screen.getByTestId('conflict-share')).toHaveTextContent(/ลด 200\.00/);
    await act(async () => fireEvent.press(screen.getByTestId('conflict-share-0')));
    await flush();
    const x = projectFinance(await mockFinance.load()).expenses.find((e) => e.id === 'exp-two')!;
    expect(x.conflicts).toEqual([]);
    expect(x.amountSatang).toBe(x.share!.billSatang - x.share!.discountSatang);
  });

  it('category share settings name the head they saw', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('expense-cat-cat-fuel'));
    for (const pct of ['20', '25']) {
      fireEvent.press(screen.getByTestId('expense-cat-share'));
      if (pct === '20') fireEvent.press(screen.getByTestId('cat-share-switch'));
      fireEvent.changeText(screen.getByTestId('cat-share-pct'), pct);
      await act(async () => fireEvent.press(screen.getByTestId('cat-share-save')));
      await flush();
    }
    const evs = (await mockFinance.load()).filter((e) => e.targetId === 'cat-fuel' && e.payload.t === 'category_share_set');
    expect(evs[1].baseEventId).toBe(evs[0].id);
  });
});
