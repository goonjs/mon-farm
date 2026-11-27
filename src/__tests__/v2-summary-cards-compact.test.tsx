/**
 * Summary cards and lines show short money (owner rule 2026-10-31, skill
 * summary-lines §1): at most 4 digits with k / m, "฿" kept with the digits
 * (pill), screen readers hear the exact amount, and the exact amount is one
 * tap away. Follows PR 251 (the expense totals card) for the cards it left.
 */

import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { tokens } from '../../design/tokens';
import { messages } from '../i18n/messages';
import { FARM_FUNDS, type FinanceEvent, type FinancePayload } from '../core/finance/types';
import { PersonScreen } from '../v2/farm/people-screens';
import { DebtAccountScreen, DebtsScreen } from '../v2/money/debts-screens';
import { OwedScreen } from '../v2/money/owed-screen';
import type { MasterStore } from '../store/master-store';
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
jest.mock('expo-router', () => {
  const params: { current: Record<string, string> } = { current: {} };
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => true) };
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
const people = () => (jest.requireMock('../store/people') as { peopleStore: MasterStore }).peopleStore;

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

let seq = 0;
async function write(targetId: string, payload: FinancePayload) {
  seq += 1;
  const e: FinanceEvent = { id: `sc-${seq}`, groupId: 'group-1', deviceSeq: seq, ts: seq, actor: { userId: 'u', deviceId: 'dev-sc' }, source: 'app', targetId, baseEventId: null, payload };
  await mockFinance.append(e);
}

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const FARM = { id: FARM_FUNDS, name: 'เงินสวน' };
const SOM = { id: 'p-som', name: 'อาจารย์สมหวัง' };
const NAT = { id: 'p-nat', name: 'นัด' };
const LENDER = { id: 'p-aunt', name: 'ป้าแก้ว' };
let red = { id: '', name: 'แดง' };

beforeAll(async () => {
  red = await people().create('แดง', ['tapper']);
  red = { id: red.id, name: red.name };
  // The farm owes back: อาจารย์สมหวัง 12,540.00 (two items), นัด 640.50.
  const expense = (amountSatang: number, payer: { id: string; name: string }) =>
    ({ t: 'expense_created', fields: { amountSatang, date: '2026-09-01', stage: 'actual', categoryId: null, propertyId: null, item: '', note: '', payer } }) as const;
  await write('x-som-1', expense(1_000_000, SOM));
  await write('x-som-2', expense(254_000, SOM));
  await write('x-nat', expense(64_050, NAT));
  // แดง owes the farm 12,540.50 and owes ป้าแก้ว 3,250.50 (shown, never deducted); plan 4,267.50 a sale.
  const loan = (id: string, amountSatang: number, lender: { id: string; name: string }) =>
    write(id, { t: 'debt_added', fields: { worker: red, kind: 'loan', amountSatang, date: '2026-09-01', note: '', lender, fertilizer: null, carriedForward: false } });
  await loan('d-red-farm', 1_254_050, FARM);
  await loan('d-red-aunt', 325_050, LENDER);
  await write(`plan-${red.id}`, { t: 'debt_plan_set', worker: red, perSaleSatang: 426_750 });
});

describe('owed page (owed-screen)', () => {
  it('the total card is short money with the unit stressed and the exact amount spoken', async () => {
    wrap(<OwedScreen />);
    await flush();
    const total = screen.getByTestId('owed-total');
    expect(total).toHaveTextContent(/^฿\s13\.18k$/);
    expect([total.props.children].flat()[0]).toBe('฿ 13.18');
    expect(total.props.accessibilityLabel).toBe('13,180.50 บาท');
    expect(flat(screen.getByTestId('owed-total-unit').props.style).backgroundColor).toBe(tokens.color.light.actionSunk);
    expect(screen.getByTestId('owed-total-card')).not.toHaveTextContent(/13,180\.50/);
  });

  it('tapping the total card opens the exact amounts, total and per person; ✕ closes it', async () => {
    wrap(<OwedScreen />);
    await flush();
    const card = screen.getByTestId('owed-total-card');
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityHint).toBe('ดูยอดเต็ม');
    expect(screen.queryByTestId('owed-exact-sheet')).toBeNull();
    fireEvent.press(card);
    const sheet = screen.getByTestId('owed-exact-sheet');
    expect(sheet.props.accessibilityLabel).toBe('ยอดเต็ม');
    expect(screen.getByTestId('owed-exact-total')).toHaveTextContent(/^สวนต้องคืนรวม13,180\.50 บาท$/);
    expect(screen.getByTestId(`owed-exact-${SOM.id}`)).toHaveTextContent(/^อาจารย์สมหวัง12,540\.00 บาท$/);
    expect(screen.getByTestId(`owed-exact-${NAT.id}`)).toHaveTextContent(/^นัด640\.50 บาท$/);
    fireEvent.press(screen.getByTestId('owed-exact-sheet-close'));
    expect(screen.queryByTestId('owed-exact-sheet')).toBeNull();
  });

  it('what is left per person is short money; opening the person shows the exact amount', async () => {
    wrap(<OwedScreen />);
    await flush();
    const som = screen.getByTestId(`owed-amount-${SOM.id}`);
    expect(som).toHaveTextContent(/^฿\s12\.54k$/);
    expect(som.props.accessibilityLabel).toBe('12,540.00 บาท');
    expect(screen.getByTestId(`owed-amount-${NAT.id}`)).toHaveTextContent(/^฿\s640\.5$/);
    expect(screen.queryByTestId(`owed-left-${SOM.id}`)).toBeNull();
    fireEvent.press(screen.getByTestId(`owed-open-${SOM.id}`));
    expect(screen.getByTestId(`owed-left-${SOM.id}`)).toHaveTextContent(/^ยอดเต็ม 12,540\.00 บาท$/);
  });
});

describe('debt list (debts-screens)', () => {
  it('the balance per worker and per other lender are short money, spoken exactly', async () => {
    wrap(<DebtsScreen />);
    await flush();
    const row = screen.getByTestId(`debt-account-${red.id}`);
    expect(row).not.toHaveTextContent(/12,540\.50|3,250\.50/);
    expect(row).toHaveTextContent(/หนี้ที่ติดสวน ฿\s12\.54k/);
    expect(row).toHaveTextContent(/ยืม ป้าแก้ว ฿\s3,251 · ไม่หักจากเงินขาย/);
    expect(within(row).getByLabelText('12,540.50 บาท')).toBeTruthy();
    expect(within(row).getByLabelText('3,250.50 บาท')).toBeTruthy();
  });
});

describe('debt account (debts-screens, debt-plan)', () => {
  beforeEach(() => {
    mockParams.current = { workerId: red.id, name: 'แดง' };
  });

  it('the balance card is short money; the reconciliation card keeps the exact figure (owner question)', async () => {
    wrap(<DebtAccountScreen />);
    await flush();
    const bal = screen.getByTestId('debt-balance');
    expect(bal).toHaveTextContent(/^฿\s12\.54k$/);
    expect([bal.props.children].flat()[0]).toBe('฿ 12.54');
    expect(bal.props.accessibilityLabel).toBe('12,540.50 บาท');
    expect(screen.getByTestId('debt-summary-balance').props.children).toBe('12,540.50');
  });

  it('tapping the balance opens the exact balance and each other lender; ✕ closes it', async () => {
    wrap(<DebtAccountScreen />);
    await flush();
    const card = screen.getByTestId('debt-balance-card');
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityHint).toBe('ดูยอดเต็ม');
    fireEvent.press(card);
    expect(screen.getByTestId('debt-exact-sheet').props.accessibilityLabel).toBe('ยอดเต็ม');
    expect(screen.getByTestId('debt-exact-balance')).toHaveTextContent(/^แดงค้างสวน12,540\.50 บาท$/);
    expect(screen.getByTestId(`debt-exact-other-${LENDER.id}`)).toHaveTextContent(/^ป้าแก้ว3,250\.50 บาท$/);
    fireEvent.press(screen.getByTestId('debt-exact-sheet-close'));
    expect(screen.queryByTestId('debt-exact-sheet')).toBeNull();
  });

  it('the other-lenders card is short money and opens the same exact sheet', async () => {
    wrap(<DebtAccountScreen />);
    await flush();
    const amount = screen.getByTestId(`debt-other-${LENDER.id}-amount`);
    expect(amount).toHaveTextContent(/^฿\s3,251$/);
    expect(amount.props.accessibilityLabel).toBe('3,250.50 บาท');
    const card = screen.getByTestId('debt-others-card');
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityHint).toBe('ดูยอดเต็ม');
    fireEvent.press(card);
    expect(screen.getByTestId(`debt-exact-other-${LENDER.id}`)).toHaveTextContent(/3,250\.50 บาท$/);
  });

  it('the per-sale plan (debt.planValue) is short money; the plan sheet one tap away has the exact amount', async () => {
    wrap(<DebtAccountScreen />);
    await flush();
    const plan = screen.getByTestId('debt-plan');
    expect(plan).toHaveTextContent(/^฿\s4,268 \/ การขาย$/);
    expect(within(plan).getByLabelText('4,267.50 บาท')).toBeTruthy();
    fireEvent.press(screen.getByTestId('debt-plan-row'));
    expect(screen.getByTestId('debt-plan-sheet')).toHaveTextContent(/4,267\.50/);
  });
});

describe("a person's page (people-screens)", () => {
  it('the debt line and the plan line are short money, spoken exactly', async () => {
    mockParams.current = { id: red.id };
    wrap(<PersonScreen />);
    await flush();
    const item = screen.getByTestId('debt-summary');
    expect(item).not.toHaveTextContent(/12,540\.50|4,267\.50/);
    expect(item).toHaveTextContent(/หนี้ที่ติดสวน ฿\s12\.54k/);
    expect(item).toHaveTextContent(/ผ่อน ฿\s4,268 \/ การขาย/);
    expect(within(item).getByLabelText('12,540.50 บาท')).toBeTruthy();
    expect(within(item).getByLabelText('4,267.50 บาท')).toBeTruthy();
  });
});

describe('messages a short figure is put into (review of PR 254 N4)', () => {
  // withMoney puts the figure where {amount} is: a message without it would drop the figure without an error.
  const ids = ['debt.list.owes', 'v2m.otherLender', 'v2f.debtFarm', 'v2f.debtPlan', 'debt.planValue', 'v2m.exact.line'] as const;
  for (const locale of ['th', 'en'] as const) {
    it.each(ids)(`${locale}: %s has {amount} exactly once`, (id) => {
      const text: string = messages[locale][id] ?? messages.th[id];
      expect(text.split('{amount}')).toHaveLength(2);
    });
  }
});
