import { act, screen, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { LogBuilder, readyPile, setUpSale } from '../core/fixtures';
import type { FinanceEvent } from '../core/finance/types';
import type { SaleEvent } from '../core/types';
import { financeStore as mockFinance } from '../store/finance';
import { store as mockStore } from '../store/store';
import { wrap } from '../test/render';
import { V2Home } from '../v2/home-screen';

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
// A Link navigates like expo-router's: pressing its child pushes its href.
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
// The cover scene has its own suite (src/v2/home-cover); here it stands in still, so its timers stay out of these tests.
jest.mock('../v2/home-cover', () => {
  const { View } = jest.requireActual('react-native');
  return {
    HomeCover: ({ onDragChange }: { onDragChange?: (d: boolean) => void }) => (
      <View testID="home-cover" accessibilityLabel="ภาพปก: สวนยางริมลำธาร" onTouchStart={() => onDragChange?.(true)} onTouchEnd={() => onDragChange?.(false)} />
    ),
  };
});
const { router: mockRouter } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** The fixtures start a sale at 1_770_000_000_000 (2026-02-02); this shifts every sale to 2026-11-10, after the day money piles are counted from. */
const SHIFT = Date.UTC(2026, 10, 10, 3) - 1_770_000_000_000;
const SALE_DAY_NOW = 1_770_000_600_000 + SHIFT;
const now = SALE_DAY_NOW;

beforeEach(() => {
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockRouter.push.mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
});

async function seedSale(id: string) {
  const b = setUpSale(new LogBuilder(id));
  readyPile(b, 'p1');
  b.accept('p1');
  for (const e of b.build() as SaleEvent[]) await mockStore.append({ ...e, ts: e.ts + SHIFT });
}
let seq = 0;
const tick = (saleId: string, payee: string, done: boolean, base: string | null) => {
  const id = `t-${++seq}`;
  const e: FinanceEvent = {
    id,
    groupId: 'group-1',
    deviceSeq: seq,
    ts: SALE_DAY_NOW + seq,
    actor: { userId: 'u', deviceId: 'dev-other' },
    source: 'app',
    targetId: `payment-${saleId}-${payee}`,
    baseEventId: base,
    payload: { t: 'payment_mark_set', saleId, payee, done, amountSatang: 100 },
  };
  mockFinance.append(e);
  return id;
};
const WEIGHING_WHY = 'ชั่งอยู่ · ชั่งเสร็จแล้วจ่ายเงินและกดปิดการขาย';
const CLEARING_WHY = 'เคลียร์เงินอยู่ · จ่ายให้ครบแล้วกดปิดการขาย';
const rowChip = () => within(screen.getByTestId('home-open-sale'));

/**
 * E15-S08 CL-1 · while the money is being cleared, the home's unclosed-sale row says "กำลังเคลียร์เงิน"
 * (owner 2026-11-21, dashboard `home-unclosed-row-label`). The phase is the start tile's (S3), so a pile
 * still counting does not hold the row on "กำลังชั่ง". The stores are shared in file order.
 */
describe('V2Home — the unclosed-sale row while clearing (E15-S08)', () => {
  it('counting, nothing ticked: the row still says กำลังชั่ง', async () => {
    await seedSale('s-now');
    wrap(<V2Home />);
    await flush();
    expect(rowChip().getByText('กำลังชั่ง')).toBeTruthy();
    expect(rowChip().queryByText('กำลังเคลียร์เงิน')).toBeNull();
    expect(rowChip().getByText(WEIGHING_WHY)).toBeTruthy();
    expect(rowChip().queryByText(CLEARING_WHY)).toBeNull();
  });

  let first = '';
  it('a payee ticked (a pile still counting): the row says กำลังเคลียร์เงิน, with the calculator tile', async () => {
    first = tick('s-now', 'owner', true, null);
    wrap(<V2Home />);
    await flush();
    expect(rowChip().getByText('กำลังเคลียร์เงิน')).toBeTruthy();
    expect(rowChip().queryByText('กำลังชั่ง')).toBeNull();
    expect(screen.getByTestId('home-sale-start-badge').props.accessibilityLabel).toBe('รอเคลียร์เงิน');
    // Owner 2026-11-21 (dashboard `home-clearing-reason-line`): the reason line follows the clearing phase too.
    expect(rowChip().getByText(CLEARING_WHY)).toBeTruthy();
    expect(rowChip().queryByText(WEIGHING_WHY)).toBeNull();
  });

  it('the tick taken back: the row goes back to กำลังชั่ง', async () => {
    tick('s-now', 'owner', false, first);
    wrap(<V2Home />);
    await flush();
    expect(rowChip().getByText('กำลังชั่ง')).toBeTruthy();
    expect(rowChip().queryByText('กำลังเคลียร์เงิน')).toBeNull();
    expect(rowChip().getByText(WEIGHING_WHY)).toBeTruthy();
    expect(rowChip().queryByText(CLEARING_WHY)).toBeNull();
  });
});
