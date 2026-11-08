import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AddDebtScreen, PayDebtScreen } from '../v2/money/debt-forms';
import { DebtAccountScreen } from '../v2/money/debts-screens';
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
const { __params: mockParams } = jest.requireMock('expo-router') as { __params: { current: Record<string, string> } };

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const DAENG = { workerId: 'p-daeng', name: 'แดง' };

/**
 * E01-S20 rows 9–11 — NP-4 value tests, written on the old text boxes first.
 * Only `enter` knows how a value is typed (old: changeText; new: the pad).
 */
const enter = async (field: 'debt-amount' | 'debt-pay-amount' | 'debt-plan-amount', text: string) => {
  // Old (on the text boxes, all 11 passed): act(() => fireEvent.changeText(screen.getByTestId(field), text)).
  await act(async () => fireEvent.press(screen.getByTestId(field)));
  for (const k of text) await act(async () => fireEvent.press(screen.getByTestId(`${field}-pad-key-${k}`)));
  await act(async () => fireEvent.press(screen.getByTestId(`${field}-done`)));
};
/** Owner q2 = ก (2026-11-08): a field whose screen never saves 0 shuts ตกลง at 0 and says so at the pad. */
const shutAtZero = (field: string) => {
  expect(screen.getByTestId(`${field}-done`).props.accessibilityState).toMatchObject({ disabled: true });
  expect(screen.getByTestId(`${field}-problem`)).toHaveTextContent('ต้องมากกว่า 0');
};
const openZero = async (field: string) => {
  await act(async () => fireEvent.press(screen.getByTestId(field)));
  await act(async () => fireEvent.press(screen.getByTestId(`${field}-pad-key-0`)));
};
const payloads = async (t: string) => (await mockFinance.load()).map((e) => e.payload).filter((p) => p.t === t) as unknown as Record<string, any>[];
const save = async (id: string) => {
  await act(async () => fireEvent.press(screen.getByTestId(id)));
  await flush();
};

/** E06-S09 PR-c: the plan opens as a sheet from the whole plan card; the per-sale plan is "บาท / การขาย". */
const openPlan = async () => {
  await save('debt-plan-row');
  // Nothing owed: the sheet is already "บาท / การขาย" and offers no count (review PR-c 1).
  if (screen.queryByTestId('debt-plan-mode-amount')) await save('debt-plan-mode-amount');
};

// The memory store is shared by the file: each test gets its own worker, so one test's debts never decide another's.
let n = 0;
beforeEach(() => {
  n += 1;
  mockParams.current = { workerId: `p-np-${n}`, name: DAENG.name };
});

describe('row 9 debt-amount: the amount of a new debt (NP-4)', () => {
  it.each([
    ['3000', 300_000],
    ['1250.5', 125_050],
    ['0.01', 1],
    ['99999999.99', 9_999_999_999],
  ])('%s → %i satang', async (text, satang) => {
    const before = (await payloads('debt_added')).length;
    wrap(<AddDebtScreen />);
    await flush();
    await enter('debt-amount', text);
    await save('debt-save');
    const added = (await payloads('debt_added')).slice(before);
    expect(added.map((p) => p.fields.amountSatang)).toEqual([satang]);
    expect(added[0].fields.kind).toBe('loan');
  });

  it.each([['blank', ''], ['0', '0']])('%s is never saved and says the amount is needed', async (_, text) => {
    const before = (await payloads('debt_added')).length;
    wrap(<AddDebtScreen />);
    await flush();
    if (text) await enter('debt-amount', text);
    await save('debt-save');
    expect(screen.getAllByText('ใส่จำนวนเงิน').length).toBeGreaterThan(0);
    expect((await payloads('debt_added')).length).toBe(before);
  });
});

describe('0 on the pad (owner q2 = ก)', () => {
  it('debt-amount: ตกลง is shut at 0 and says ต้องมากกว่า 0', async () => {
    wrap(<AddDebtScreen />);
    await flush();
    await openZero('debt-amount');
    shutAtZero('debt-amount');
  });

  it('debt-pay-amount: ตกลง is shut at 0', async () => {
    wrap(<PayDebtScreen />);
    await flush();
    await openZero('debt-pay-amount');
    shutAtZero('debt-pay-amount');
  });

  it('debt-plan-amount: ตกลง is shut at 0', async () => {
    wrap(<DebtAccountScreen />);
    await flush();
    await openPlan();
    await openZero('debt-plan-amount');
    shutAtZero('debt-plan-amount');
  });
});

describe('row 10 debt-pay-amount: a payment (NP-4)', () => {
  it.each([
    ['500', 50_000],
    ['12.5', 1_250],
    ['99999999.99', 9_999_999_999],
  ])('%s → %i satang (no debt yet: the over-pay warning, then save anyway)', async (text, satang) => {
    const before = (await payloads('debt_payment_recorded')).length;
    wrap(<PayDebtScreen />);
    await flush();
    await enter('debt-pay-amount', text);
    await save('debt-pay-save');
    expect(screen.getByTestId('debt-pay-over')).toBeTruthy();
    await save('debt-pay-anyway');
    const paid = (await payloads('debt_payment_recorded')).slice(before);
    expect(paid.map((p) => p.fields.amountSatang)).toEqual([satang]);
  });

  it('within the balance: no warning, saved at once; a new amount clears an old warning', async () => {
    wrap(<AddDebtScreen />);
    await flush();
    await enter('debt-amount', '1000');
    await save('debt-save');
    const before = (await payloads('debt_payment_recorded')).length;
    wrap(<PayDebtScreen />);
    await flush();
    await enter('debt-pay-amount', '2000');
    await save('debt-pay-save');
    expect(screen.getByTestId('debt-pay-over')).toBeTruthy();
    await enter('debt-pay-amount', '400');
    expect(screen.queryByTestId('debt-pay-over')).toBeNull();
    expect(screen.getByTestId('debt-pay-save').props.accessibilityState).toMatchObject({ disabled: false });
    await save('debt-pay-save');
    expect(screen.queryByTestId('debt-pay-over')).toBeNull();
    expect((await payloads('debt_payment_recorded')).slice(before).map((p) => p.fields.amountSatang)).toEqual([40_000]);
  });

  it('blank or 0 cannot be saved', async () => {
    const before = (await payloads('debt_payment_recorded')).length;
    wrap(<PayDebtScreen />);
    await flush();
    expect(screen.getByTestId('debt-pay-save').props.accessibilityState).toMatchObject({ disabled: true });
    await enter('debt-pay-amount', '0');
    expect(screen.getByTestId('debt-pay-save').props.accessibilityState).toMatchObject({ disabled: true });
    expect((await payloads('debt_payment_recorded')).length).toBe(before);
  });
});

describe('row 11 debt-plan-amount: instalment per sale (NP-4)', () => {
  it.each([
    ['1500', 150_000],
    ['250.5', 25_050],
    ['99999999.99', 9_999_999_999],
  ])('%s → %i satang', async (text, satang) => {
    const before = (await payloads('debt_plan_set')).length;
    wrap(<DebtAccountScreen />);
    await flush();
    await openPlan();
    await enter('debt-plan-amount', text);
    await save('debt-plan-save');
    const set = (await payloads('debt_plan_set')).slice(before);
    expect(set.map((p) => p.perSaleSatang)).toEqual([satang]);
  });

  it('0 or blank cannot be saved as a plan', async () => {
    wrap(<DebtAccountScreen />);
    await flush();
    await openPlan();
    expect(screen.getByTestId('debt-plan-save').props.accessibilityState).toMatchObject({ disabled: true });
    await enter('debt-plan-amount', '0');
    expect(screen.getByTestId('debt-plan-save').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('editing a plan without changing it saves the same amount (prefill round-trip)', async () => {
    // A plan belongs to an account, and an account starts with a debt.
    wrap(<AddDebtScreen />);
    await flush();
    await enter('debt-amount', '3000');
    await save('debt-save');
    wrap(<DebtAccountScreen />);
    await flush();
    await openPlan();
    await enter('debt-plan-amount', '250.05');
    await save('debt-plan-save');
    const before = (await payloads('debt_plan_set')).length;
    await openPlan();
    await act(async () => fireEvent.press(screen.getByTestId('debt-plan-amount')));
    await act(async () => fireEvent.press(screen.getByTestId('debt-plan-amount-done')));
    await save('debt-plan-save');
    expect((await payloads('debt_plan_set')).slice(before).map((p) => p.perSaleSatang)).toEqual([25_005]);
  });
});
