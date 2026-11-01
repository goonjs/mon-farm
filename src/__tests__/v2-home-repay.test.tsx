import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { LogBuilder } from '../core/fixtures';
import { paymentMarkPayload, paymentTarget, OWNER_PAYEE } from '../core/finance/payments';
import { debtCashPayee } from '../core/finance/pending-repays';
import { FARM_FUNDS, type DebtPaymentMethod } from '../core/finance/types';
import type { SaleEvent } from '../core/types';
import { writeFinance } from '../store/finance-write';
import { store as mockStore } from '../store/store';
import { wrap } from '../test/render';
import { V2Home } from '../v2/home-screen';

/**
 * E06-S08 · the home rows for repayments not received yet (H1 · PR-14) and
 * for what a buyer still owes the farm per sale (H2 · PR-16, D-87).
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
  const { cloneElement } = jest.requireActual('react');
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
  return {
    Link: ({ children, href }: { children: ReactElement<{ onPress?: () => void }>; href: string }) =>
      cloneElement(children, { onPress: () => router.push(href) }),
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => ({}),
    useRouter: () => router,
    router,
  };
});
const { router: mockRouter } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const FARM = { id: FARM_FUNDS, name: 'เงินสวน' };
const RED = { id: 'w-red', name: 'แดง' };
const NAT = { id: 'w-nat', name: 'นัด' };
const EK = { id: 'w-ek', name: 'เอก' };

async function debt(w: { id: string; name: string }) {
  await writeFinance(`debt-${w.id}`, null, { t: 'debt_added', fields: { worker: w, kind: 'loan', amountSatang: 10_000_000, date: '2026-09-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
}
async function deduct(saleId: string, w: { id: string; name: string }, amountSatang: number, method: DebtPaymentMethod, date = '2026-11-01') {
  await writeFinance(`dp-${saleId}-${w.id}`, null, { t: 'debt_payment_recorded', fields: { worker: w, creditor: FARM, amountSatang, date, note: '', method, saleId } });
}
async function tick(saleId: string, payee: string, amount: number, received?: number) {
  await writeFinance(paymentTarget(saleId, payee), null, paymentMarkPayload(saleId, payee, true, amount, received));
}
async function sale(id: string, buyer: string) {
  const b = new LogBuilder(id).sys({ t: 'sale_started', farmName: '', buyer, manager: '', workerLead: '', where: 'farm' });
  for (const e of b.build() as SaleEvent[]) await mockStore.append(e);
}

beforeAll(async () => {
  for (const w of [RED, NAT, EK]) await debt(w);
});
beforeEach(() => mockRouter.push.mockClear());

describe('H1 · PR-14 เงินคืนหนี้ ยังไม่เข้าสวน', () => {
  it('no row while nothing is waiting', async () => {
    wrap(<V2Home />);
    await flush();
    expect(screen.queryByTestId('home-repay-wait')).toBeNull();
  });

  it('per person, 2 per line, then Σ on its own line; opens the debt list', async () => {
    await deduct('s-wait', RED, 325_000, 'transfer-with-owner');
    await deduct('s-wait', NAT, 525_000, 'buyer-split');
    await deduct('s-wait', EK, 100_000, 'cash-from-share');
    wrap(<V2Home />);
    await flush();
    const row = screen.getByTestId('home-repay-wait');
    expect(row).toHaveTextContent(/เงินคืนหนี้ ยังไม่เข้าสวน · รอคนซื้อ/);
    // core's order (pendingRepayLines: by sale, then worker id)
    expect(screen.getByTestId('home-repay-wait-line-0')).toHaveTextContent('เอก ฿ 1,000 · นัด ฿ 5,250');
    expect(screen.getByTestId('home-repay-wait-line-1')).toHaveTextContent('แดง ฿ 3,250');
    expect(screen.getByTestId('home-repay-wait-sum')).toHaveTextContent('Σ รวม ฿ 9,500');
    await act(async () => fireEvent.press(row));
    expect(mockRouter.push).toHaveBeenCalledWith('/v2/debts');
  });

  it('a received tick takes that person off the row', async () => {
    await tick('s-wait', OWNER_PAYEE, 2_000_000);
    await tick('s-wait', debtCashPayee(EK.id), 100_000);
    wrap(<V2Home />);
    await flush();
    expect(screen.getByTestId('home-repay-wait-line-0')).toHaveTextContent('นัด ฿ 5,250');
    expect(screen.queryByTestId('home-repay-wait-line-1')).toBeNull();
    expect(screen.getByTestId('home-repay-wait-sum')).toHaveTextContent('Σ รวม ฿ 5,250');
  });
});

describe('H2 · PR-16 คนซื้อค้างสวน (one row per sale)', () => {
  it('no row while nothing came in short', async () => {
    wrap(<V2Home />);
    await flush();
    expect(screen.queryByTestId(/^home-owes-/)).toBeNull();
  });

  it('transfer part, cash part per worker, Σ rounded from the full total; opens the sale payment page', async () => {
    await sale('s-owe', 'ลานยางสมบูรณ์');
    await deduct('s-owe', RED, 325_050, 'buyer-split', '2026-10-29');
    // transfer short 2,687.50 · cash short 3,250.50 → Σ 5,938.00 (rounded parts would say 2,688 + 3,251)
    await tick('s-owe', OWNER_PAYEE, 1_968_750, 1_700_000);
    await tick('s-owe', debtCashPayee(RED.id), 325_050, 0);
    wrap(<V2Home />);
    await flush();
    const row = screen.getByTestId('home-owes-s-owe');
    expect(row).toHaveTextContent(/คนซื้อค้างสวน · ขาย 29 ต\.ค\. 2569 · ลานยางสมบูรณ์/);
    expect(screen.getByTestId('home-owes-s-owe-transfer')).toHaveTextContent('ส่วนโอน ฿ 2,688');
    expect(screen.getByTestId(`home-owes-s-owe-cash-${RED.id}`)).toHaveTextContent('ส่วนเงินสด (แดงจ่ายแล้ว) ฿ 3,251');
    expect(screen.getByTestId('home-owes-s-owe-sum')).toHaveTextContent('Σ รวม ฿ 5,938');
    await act(async () => fireEvent.press(row));
    expect(mockRouter.push).toHaveBeenCalledWith('/v2/sale/s-owe/payment');
  });

  it('a sale with no buyer name says just the date; transfer only has no cash line', async () => {
    await tick('s-nobuyer', OWNER_PAYEE, 1_000_000, 900_000);
    await sale('s-nobuyer', '');
    wrap(<V2Home />);
    await flush();
    const row = screen.getByTestId('home-owes-s-nobuyer');
    expect(row).toHaveTextContent(/คนซื้อค้างสวน · ขาย /);
    expect(row).not.toHaveTextContent(/ลานยาง/);
    expect(screen.getByTestId('home-owes-s-nobuyer-transfer')).toHaveTextContent('ส่วนโอน ฿ 1,000');
    expect(screen.queryByTestId(/^home-owes-s-nobuyer-cash-/)).toBeNull();
    expect(screen.getByTestId('home-owes-s-nobuyer-sum')).toHaveTextContent('Σ รวม ฿ 1,000');
  });
});
