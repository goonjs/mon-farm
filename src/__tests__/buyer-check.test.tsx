import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { BuyerCheckPanel } from '../components/finance/BuyerCheckPanel';
import { buyerCheck, type DrillZone, type SaleFigures } from '../core/finance/buyer-check';
import { financeStore as mockFinance } from '../store/finance';
import { wrap } from '../test/render';

jest.mock('../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({}),
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const OURS: SaleFigures = { netG: 11273000, satangPerKg: 2650, grossSatang: 29873450, baskets: 226 };
const SHORTS = [{ zoneId: 'zA', zoneName: 'โซน A', baskets: 3, netG: 123000 }];
const DRILL: DrillZone[] = [
  {
    zoneId: 'zA',
    name: 'โซน A',
    piles: [{ pileId: 'p1', name: 'กอง 1', netG: 141000, baskets: [{ id: 'b1', netG: 50000, short: false }, { id: 'b2', netG: 41000, short: true }, { id: 'b3', netG: 50000, short: false }] }],
  },
];

const panel = (saleId: string, ours = OURS) => <BuyerCheckPanel saleId={saleId} ours={ours} shorts={SHORTS} drill={DRILL} />;
const recorded = async (saleId: string, ours = OURS) => buyerCheck(await mockFinance.load(), saleId, ours);

describe('buyer check screen (E05-S03)', () => {
  it('shows our total under "ยอดที่คำนวณได้ทั้งหมด" with the short baskets by zone, status pending', async () => {
    wrap(panel('s1'));
    await flush();
    expect(screen.getByText('ยอดที่คำนวณได้ทั้งหมด')).toBeTruthy();
    expect(screen.getByTestId('check-ours-gross-amount').props.children).toBe('298,734.50');
    expect(screen.getByTestId('check-ours-kg').props.children).toBe('11,273 กก.');
    expect(screen.getByTestId('check-short-zA').props.children).toBe('เข่งไม่เต็ม โซน A 3 เข่ง · 123 กก.');
    expect(screen.getByTestId('check-status').props.children).toBe('รอตรวจสอบเทียบยอด');
  });

  it('"ตรงกันทั้งหมด" records the match in one tap', async () => {
    wrap(panel('s1'));
    await flush();
    await act(async () => fireEvent.press(screen.getByTestId('check-all-match')));
    await flush();
    expect((await recorded('s1')).status).toBe('total');
    expect(screen.getByTestId('check-status').props.children).toBe('ยอดผู้ขายและผู้ซื้อตรงกัน');
  });

  it('a basket changed after the check → pending again with a recheck flag', async () => {
    wrap(panel('s1', { ...OURS, netG: OURS.netG - 50000, grossSatang: OURS.grossSatang - 132500, baskets: 225 }));
    await flush();
    expect(screen.getByTestId('check-status').props.children).toBe('รอตรวจสอบเทียบยอด');
    expect(screen.getByTestId('check-stale')).toBeTruthy();
  });

  it('"ไม่ตรงกัน" → drill to the baskets, or close as difference found with a reason (required)', async () => {
    wrap(panel('s2'));
    await flush();
    fireEvent.press(screen.getByTestId('check-mismatch'));
    fireEvent.press(screen.getByTestId('drill-zone-zA'));
    fireEvent.press(screen.getByTestId('drill-pile-p1'));
    expect(screen.getByTestId('drill-basket-b2').props.children).toContain('41');
    fireEvent.changeText(screen.getByTestId('check-buyer-kg'), '11223');
    expect(screen.getByTestId('check-diff-save').props.accessibilityState?.disabled).toBe(true);
    fireEvent.changeText(screen.getByTestId('check-reason'), 'ผู้ซื้อนับเข่งขาดหนึ่ง');
    await act(async () => fireEvent.press(screen.getByTestId('check-diff-save')));
    await flush();
    const r = await recorded('s2');
    expect(r).toMatchObject({ status: 'diff', reason: 'ผู้ซื้อนับเข่งขาดหนึ่ง', diff: { netG: -50000, grossSatang: null, baskets: null } });
    expect(screen.getByTestId('check-status').props.children).toBe('พบส่วนต่าง');
    expect(screen.getByTestId('check-diff-kg').props.children).toBe('ผู้ซื้อ −50 กก.');
  });

  it('weight verified, then undone back to pending', async () => {
    wrap(panel('s3'));
    await flush();
    await act(async () => fireEvent.press(screen.getByTestId('check-weight')));
    await flush();
    expect(screen.getByTestId('check-status').props.children).toBe('ยืนยันน้ำหนักรวมตรงกัน');
    await act(async () => fireEvent.press(screen.getByTestId('check-undo')));
    await flush();
    expect((await recorded('s3')).status).toBe('pending');
  });
});
