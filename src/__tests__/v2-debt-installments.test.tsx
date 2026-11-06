import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { planPayload, seenSnapshot } from '../core/finance/installments';
import { FARM_FUNDS, type FinancePayload } from '../core/finance/types';
import { maxInstallments } from '../core/master';
import { financeStore as mockFinance } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import type { MasterStore } from '../store/master-store';
import { wrap } from '../test/render';
import { SaleSettingsScreen } from '../v2/farm/sale-settings-screen';
import { DebtAccountScreen, DebtsScreen } from '../v2/money/debts-screens';

/**
 * E06-S09 PR-c · the plan on the debt account and the farm setting (mockup band ค, D4, ตั้งค่า · IP-17…IP-22).
 * นัด owes 12,800 (mockup example), plan of 3 set at sale s1 where instalment 1 (4,267) was deducted.
 */

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
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => params.current,
    useRouter: () => router,
    router,
    __params: params,
  };
});
const { __params: mockParams } = jest.requireMock('expo-router') as { __params: { current: Record<string, string> } };
const master = () => (jest.requireMock('../store/people') as { peopleStore: MasterStore }).peopleStore;

async function flush() {
  for (let i = 0; i < 3; i++) await act(async () => new Promise((r) => setTimeout(r, 0)));
}
const press = async (id: string) => {
  await act(async () => fireEvent.press(screen.getByTestId(id)));
  await flush();
};
const text = (id: string) => screen.getByTestId(id);
const FARM = { id: FARM_FUNDS, name: 'เงินสวน' };
const plans = async () => (await mockFinance.load()).filter((e) => e.payload.t === 'debt_plan_set').map((e) => e.payload) as Extract<FinancePayload, { t: 'debt_plan_set' }>[];

let n = 0;
/** A fresh worker each test (the memory stores are shared by the file). */
async function seed(o: { plan?: boolean; paid?: number[] } = {}) {
  n += 1;
  const w = { id: `w${n}`, name: `นัด${n}` };
  await writeFinance(`d-${w.id}`, null, { t: 'debt_added', fields: { worker: w, kind: 'fertilizer', amountSatang: 1_280_000, date: '2026-10-14', note: '', lender: null, fertilizer: { totalSatang: 2_560_000, workerPct: 50 }, carriedForward: false } });
  if (o.plan) {
    const seen = seenSnapshot(await mockFinance.load());
    await writeFinance(`plan-${w.id}`, null, planPayload({ worker: w, count: 3, fromSaleId: `s1-${w.id}`, seen, owedSatang: 1_280_000, balanceSatang: 1_280_000 }));
  }
  for (const [k, satang] of (o.paid ?? []).entries()) {
    await writeFinance(`pay-${w.id}-${k}`, null, { t: 'debt_payment_recorded', fields: { worker: w, creditor: FARM, amountSatang: satang, date: `2026-11-0${4 + k}`, note: '', method: 'transfer-with-owner', saleId: `s${k + 1}-${w.id}` } });
  }
  mockParams.current = { workerId: w.id, name: w.name };
  return w;
}

describe('IP-17 · the debt list says the plan', () => {
  it('"ผ่อนงวด 2/3 · งวดละ ฿ 4,267"; no plan → "ไม่ผ่อน · หักเต็มส่วนแบ่ง"', async () => {
    const a = await seed({ plan: true, paid: [426_700] });
    const b = await seed();
    wrap(<DebtsScreen />);
    await flush();
    expect(text(`debt-plan-badge-${a.id}`)).toHaveTextContent(/ผ่อนงวด 2\/3 · งวดละ.*4,267/);
    expect(text(`debt-plan-badge-${b.id}`)).toHaveTextContent('ไม่ผ่อน · หักเต็มส่วนแบ่ง');
  });
});

describe('IP-18 · the account plan card, the whole card tappable; the history numbers the instalments', () => {
  it('"ผ่อน 3 งวด · จ่ายแล้ว 1 งวด", next 4,267 · last 4,266; "หักงวด 1/3"; no round "แก้"', async () => {
    const w = await seed({ plan: true, paid: [426_700] });
    wrap(<DebtAccountScreen />);
    await flush();
    expect(text('debt-plan')).toHaveTextContent('ผ่อน 3 งวด · จ่ายแล้ว 1 งวด');
    expect(text('debt-plan-next')).toHaveTextContent(/งวดต่อไป.*4,267.*งวดสุดท้าย.*4,266/);
    expect(screen.queryByTestId('debt-plan-edit')).toBeNull();
    expect(text(`debt-line-pay-${w.id}-0`)).toHaveTextContent(/หักงวด 1\/3/);
    expect(text('debt-plan-row').props.accessibilityRole).toBe('button');
  });
});

describe('IP-19 · the plan sheet', () => {
  it('จำนวนงวด: 2 left → 3, 4 offered (max 4); pick 3 → was 2 more, now 3 of 2,845; saved from the next sale, instalment 1 kept', async () => {
    const w = await seed({ plan: true, paid: [426_700] });
    wrap(<DebtAccountScreen />);
    await flush();
    await press('debt-plan-row');
    expect(screen.queryByTestId('debt-plan-count-2')).toBeNull();
    expect(text('debt-plan-count-3')).toHaveTextContent(/3 งวด.*งวดละ 2,845/);
    expect(text('debt-plan-save').props.accessibilityState).toMatchObject({ disabled: true });
    await press('debt-plan-count-3');
    expect(text('debt-plan-change')).toHaveTextContent('เดิม: อีก 2 งวด · ใหม่: อีก 3 งวด งวดละ 2,845.00');
    const before = (await plans()).length;
    await press('debt-plan-save');
    const p = (await plans()).slice(before);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ worker: w, perSaleSatang: 284_500, installments: { count: 4, fromSaleId: null, earlier: [{ saleId: `s1-${w.id}` }] } });
    expect(text('debt-plan')).toHaveTextContent('ผ่อน 4 งวด · จ่ายแล้ว 1 งวด');
  });

  it('ยกเลิกแผน → no plan (back to the full share)', async () => {
    await seed({ plan: true, paid: [426_700] });
    wrap(<DebtAccountScreen />);
    await flush();
    await press('debt-plan-row');
    await press('debt-plan-cancel');
    expect(text('debt-plan')).toHaveTextContent('ไม่มีแผนผ่อน');
  });
});

describe('IP-20 · instalments ran out with debt left: a yellow alert with the figure only', () => {
  it('"ผ่อนครบ 3 งวดแล้ว ยังค้าง ฿ 1,533" and the debts left', async () => {
    // 12,800 − 4,267 − 3,000 − 4,000 = 1,533
    await seed({ plan: true, paid: [426_700, 300_000, 400_000] });
    wrap(<DebtAccountScreen />);
    await flush();
    expect(text('debt-plan-done')).toHaveTextContent(/ผ่อนครบ 3 งวดแล้ว ยังค้าง.*1,533.*หนี้ 1 ก้อน · ค่าปุ๋ย 14 ต.ค./);
  });
});

describe('IP-21 · ตั้งค่า "ผ่อนหนี้ได้สูงสุด" (2–12, default 4, synced)', () => {
  it('shows 4 งวด; pick 6 → saved; the debt sheet then offers up to 6', async () => {
    wrap(<SaleSettingsScreen />);
    await flush();
    expect(text('max-inst-value')).toHaveTextContent('4 งวด');
    await press('max-inst-row');
    expect(screen.queryByTestId('max-inst-1')).toBeNull();
    expect(text('max-inst-12')).toBeTruthy();
    await press('max-inst-6');
    await press('save-max-inst');
    expect(maxInstallments(await master().state())).toBe(6);
    expect(text('max-inst-value')).toHaveTextContent('6 งวด');
    await seed({ plan: true, paid: [426_700] });
    wrap(<DebtAccountScreen />);
    await flush();
    await press('debt-plan-row');
    expect(text('debt-plan-count-5')).toBeTruthy();
  });
});
