import { act, fireEvent, screen, within } from '@testing-library/react-native';
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
/** Four days on: the prep's day (2026-11-13) has passed unused, and every earlier sale is from another day. */
const NEXT_DAY_NOW = SALE_DAY_NOW + 4 * 86_400_000;
let now = SALE_DAY_NOW;
beforeEach(() => {
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockRouter.push.mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
  now = SALE_DAY_NOW;
});

/** Each sale starts `startsAfter` ms later than the fixtures' base, so "the newest sale" is not a tie. */
async function seedSale(id: string, startsAfter: number, finish?: (b: LogBuilder) => void) {
  const b = setUpSale(new LogBuilder(id));
  readyPile(b, 'p1');
  b.accept('p1');
  finish?.(b);
  for (const e of b.build() as SaleEvent[]) await mockStore.append({ ...e, ts: e.ts + SHIFT + startsAfter });
}
const finEvent = (id: string, targetId: string, payload: FinanceEvent['payload']): FinanceEvent => ({
  id,
  groupId: 'group-1',
  deviceSeq: 1,
  ts: SALE_DAY_NOW,
  actor: { userId: 'u', deviceId: 'dev-other' },
  source: 'app',
  targetId,
  baseEventId: null,
  payload,
});
const prep = (id: string, patch: Record<string, unknown>) => mockFinance.append(finEvent(id, 'sale-prep', { t: 'sale_prep_set', patch } as FinanceEvent['payload']));
const tick = (id: string, saleId: string, payee: string, done = true) =>
  mockFinance.append(finEvent(id, `payment-${saleId}-${payee}`, { t: 'payment_mark_set', saleId, payee, done, amountSatang: 100 }));
const badge = (tile: string) => screen.queryByTestId(`${tile}-badge`);
const completed = (b: LogBuilder) => b.sys({ t: 'sale_status_set', status: 'completed' });

/**
 * E15-S06 · the home tiles say where the prep and the sale are (owner 2026-11-17; story docs/stories/e15-s06-home-tiles-state.md).
 * The stores are shared by the tests in file order, so each step builds on the one before.
 */
describe('V2Home — เตรียมขาย and เริ่มการขาย tiles (E15-S06)', () => {
  it('nothing yet: both tiles plain, and the big prep card is gone from the home', async () => {
    wrap(<V2Home />);
    await flush();
    expect(screen.queryByTestId('home-prep')).toBeNull();
    expect(badge('home-prepare')).toBeNull();
    expect(badge('home-sale-start')).toBeNull();
  });

  it('prep not complete: yellow tile with the number of rows left (P1)', async () => {
    await prep('pp-1', { buyerId: 'b1', buyerName: 'คนรับซื้อยาง ก', date: '2026-11-13' });
    wrap(<V2Home />);
    await flush();
    expect(badge('home-prepare')).toHaveTextContent('1');
    expect(badge('home-prepare')?.props.accessibilityLabel).toBe('เหลือ 1 ข้อ');
    expect(badge('home-sale-start')).toBeNull();
  });

  it('prep complete: green tick on the prep tile, the start tile invites with the clock (P2, S1)', async () => {
    await prep('pp-2', { priceSatangPerKg: 5250 });
    wrap(<V2Home />);
    await flush();
    expect(badge('home-prepare')?.props.accessibilityLabel).toBe('ครบแล้ว');
    expect(badge('home-sale-start')?.props.accessibilityLabel).toBe('รอเริ่มขาย');
  });

  it('the sale started and counting: the start tile shows the scale (S2); the prep stays green', async () => {
    await seedSale('s-now', 0);
    wrap(<V2Home />);
    await flush();
    expect(badge('home-sale-start')?.props.accessibilityLabel).toBe('กำลังนับ');
    expect(badge('home-prepare')?.props.accessibilityLabel).toBe('ครบแล้ว');
  });

  it('counting done and the clearing step has written its ticks: the calculator (S3)', async () => {
    await seedSale('s-clear', 10_000, (b) => b.sys({ t: 'pile_closed', pileId: 'p1', forced: false }));
    await tick('t-1', 's-clear', 'owner', false);
    wrap(<V2Home />);
    await flush();
    // The newest sale decides: s-clear started after s-now.
    expect(badge('home-sale-start')?.props.accessibilityLabel).toBe('รอเคลียร์เงิน');
  });

  it('closed with money still to pay: the red number, and a tap goes to the payment page (S4)', async () => {
    await seedSale('s-done', 20_000, completed);
    wrap(<V2Home />);
    await flush();
    expect(badge('home-sale-start')).toHaveTextContent('1');
    expect(badge('home-sale-start')?.props.accessibilityLabel).toBe('เงินค้าง 1 กอง');
    fireEvent.press(screen.getByTestId('home-sale-start'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/v2/sale/s-done/payment');
  });

  it('every pile ticked paid: the tick (S5); un-ticking puts the number back (going back)', async () => {
    await tick('t-2', 's-done', 'owner', true);
    wrap(<V2Home />);
    await flush();
    expect(badge('home-sale-start')?.props.accessibilityLabel).toBe('เคลียร์เงินครบแล้ว');
  });

  it('after midnight the tiles go plain and the unfinished sales stay as rows (HT-5, HT-6)', async () => {
    now = NEXT_DAY_NOW;
    await seedSale('s-old', 30_000, completed);
    wrap(<V2Home />);
    await flush();
    expect(badge('home-prepare')).toBeNull();
    expect(badge('home-sale-start')).toBeNull();
    // s-old is closed with one pile unpaid: its row says so in red and opens the payment page.
    const row = screen.getByTestId('home-latest-sale');
    expect(within(row).getByText('เงินค้าง 1 กอง')).toBeTruthy();
    fireEvent.press(row);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/v2/sale/s-old/payment');
  });
});
