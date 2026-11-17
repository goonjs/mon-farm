import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { LogBuilder, readyPile, setUpSale } from '../core/fixtures';
import type { FinanceEvent } from '../core/finance/types';
import type { SaleEvent } from '../core/types';
import { financeStore as mockFinance } from '../store/finance';
import { peopleStore as mockPeople } from '../store/people';
import { store as mockStore } from '../store/store';
import { wrap } from '../test/render';
import { FarmMateArt } from '../ui';
import { V2Home } from '../v2/home-screen';
import { FARM_SECTIONS, sectionHref } from '../v2/routes';

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

/** The traced FarmMate originals drawn inside the element with this testID (E03-S11). */
function art(testID: string): string[] {
  return within(screen.getByTestId(testID)).UNSAFE_queryAllByType(FarmMateArt).map((a) => a.props.id as string);
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function seedSale(id: string, baskets: number, finish?: (b: LogBuilder) => void) {
  const b = setUpSale(new LogBuilder(id));
  readyPile(b, 'p1');
  for (let i = 0; i < baskets; i++) b.accept('p1');
  finish?.(b);
  for (const e of b.build() as SaleEvent[]) await mockStore.append(e);
}

async function seedOwed(name: string, satang: number) {
  const e: FinanceEvent = {
    id: `owed-${name}`,
    groupId: 'group-1',
    deviceSeq: 1,
    ts: 1,
    actor: { userId: 'u', deviceId: 'dev-other' },
    source: 'app',
    targetId: `x-${name}`,
    baseEventId: null,
    payload: {
      t: 'expense_created',
      fields: { amountSatang: satang, date: '2026-09-01', stage: 'actual', categoryId: null, propertyId: null, item: '', note: '', payer: { id: `p-${name}`, name } },
    },
  };
  await mockFinance.append(e);
}
/** A fertilizing nobody has been given a share of yet (E16-S03: "ยังไม่แบ่ง"); `deleted` adds the delete. */
async function seedUnsplitFertilizing(id: string, deleted = false) {
  const base = { groupId: 'group-1', deviceSeq: 1, ts: 1, actor: { userId: 'u', deviceId: 'dev-other' }, source: 'app' as const, baseEventId: null };
  await mockFinance.append({
    ...base,
    id: `${id}-c`,
    targetId: id,
    payload: { t: 'fertilizing_recorded', fields: { date: '2026-11-01', lines: [{ sources: ['ord-x'], sacks: 10, takes: [], rest: null }], pct: {}, settle: {}, zones: [], reasons: [], note: '' } },
  });
  if (deleted) await mockFinance.append({ ...base, id: `${id}-d`, targetId: id, baseEventId: `${id}-c`, payload: { t: 'fertilizing_changed', patch: { deleted: true } } });
}

beforeEach(() => mockRouter.push.mockClear());

// First in the file: the finance store is shared, and later blocks leave fertilizings not split.
describe('V2Home — เตรียมการขาย row (E15-S01 PREP-1)', () => {
  const prep = async (id: string, patch: Record<string, unknown>) =>
    mockFinance.append({ id, groupId: 'group-1', deviceSeq: 1, ts: Date.now(), actor: { userId: 'u', deviceId: 'dev-other' }, source: 'app', targetId: 'sale-prep', baseEventId: null, payload: { t: 'sale_prep_set', patch } });

  it('nothing prepared: "เตรียมการขายครั้งถัดไป" opens the prep page; the to-know list still says there is nothing to handle', async () => {
    wrap(<V2Home />);
    await flush();
    expect(screen.getByTestId('home-prep')).toHaveTextContent(/เตรียมการขายครั้งถัดไป/);
    expect(within(screen.getByTestId('home-to-know')).getByText('ยังไม่มีเรื่องที่ต้องรู้หรือจัดการ')).toBeTruthy();
    fireEvent.press(screen.getByTestId('home-prep'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/v2/prepare');
  });

  it('preparing: the day, the buyer and how many rows are left', async () => {
    await prep('pp-1', { buyerId: 'b1', buyerName: 'คนรับซื้อยาง ก', date: '2026-11-21' });
    wrap(<V2Home />);
    await flush();
    expect(screen.getByTestId('home-prep')).toHaveTextContent(/เตรียมขาย · ส\. 21 พ\.ย\./);
    expect(screen.getByTestId('home-prep')).toHaveTextContent(/คนรับซื้อยาง ก · เหลือ 1 ข้อ/);
  });

  it('all four done: ✓ พร้อมขาย with the buyer and the price', async () => {
    await prep('pp-2', { buyerId: 'b1', buyerName: 'คนรับซื้อยาง ก', date: '2026-11-21', priceSatangPerKg: 5250 });
    wrap(<V2Home />);
    await flush();
    expect(screen.getByTestId('home-prep')).toHaveTextContent(/✓ พร้อมขาย · ส\. 21 พ\.ย\./);
    expect(screen.getByTestId('home-prep')).toHaveTextContent(/คนรับซื้อยาง ก · 52\.50 ฿\/\u2060กก\./);
  });
});

/**
 * The v2 home (e03-v2-splash-home): flow-v1 screen 3 with the v1.1.0
 * screens 1 and 25 on top. Runs first on empty stores, then seeds them.
 */
describe('V2Home — empty farm', () => {
  it('stops the page scrolling while the cover is dragged sideways (E03-S09 CS-3)', async () => {
    wrap(<V2Home />);
    await flush();
    const page = () => screen.getByTestId('v2-home');
    expect(page().props.scrollEnabled).toBe(true);
    fireEvent(screen.getByTestId('home-cover'), 'touchStart');
    expect(page().props.scrollEnabled).toBe(false);
    fireEvent(screen.getByTestId('home-cover'), 'touchEnd');
    expect(page().props.scrollEnabled).toBe(true);
  });

  it('reads top to bottom as drawn: header with date, cover, three actions, ควรรู้, ไปที่ (owner 2026-11-16: no 2×2)', async () => {
    wrap(<V2Home />);
    await flush();
    expect(screen.getByTestId('screen-title').props.children).toBe('หน้าแรก');
    expect(screen.getByText(/^(อา|จ|อ|พ|พฤ|ศ|ส)\. \d{1,2} \S+ \d{4}$/)).toBeTruthy();
    expect(screen.getByLabelText('ภาพปก: สวนยางริมลำธาร')).toBeTruthy();

    const home = screen.getByTestId('v2-home');
    const order = ['home-cover', 'home-prepare', 'home-sale-start', 'home-record-expense', 'home-to-know', 'home-sales', 'home-go-to'];
    const all = within(home).getAllByTestId(new RegExp(`^(${order.join('|')})$`));
    expect(all.map((n) => n.props.testID)).toEqual(order);

    expect(within(screen.getByTestId('home-prepare')).getByText('เตรียมขาย')).toBeTruthy();
    expect(within(screen.getByTestId('home-sale-start')).getByText('เริ่มการขาย')).toBeTruthy();
    expect(within(screen.getByTestId('home-record-expense')).getByText('บันทึกค่าใช้จ่าย')).toBeTruthy();
    // Garden care is not a big button any more (owner 2026-11-16): it sits with the ไปที่ tiles.
    expect(screen.queryByTestId('home-care')).toBeNull();
    expect(screen.queryByTestId('mod-care-flag')).toBeNull();
    expect(screen.getByText('ควรรู้ / ควรจัดการ')).toBeTruthy();
    expect(screen.getByText('สำคัญก่อน')).toBeTruthy();
    expect(screen.getByText('ไปที่')).toBeTruthy();
  });

  it('keeps the header date current when the app comes back the next day', async () => {
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'setImmediate', 'nextTick', 'queueMicrotask'] });
    jest.setSystemTime(Date.UTC(2026, 9, 3, 5)); // Sat 3 Oct, noon Bangkok
    let onChange: ((s: AppStateStatus) => void) | undefined;
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
      onChange = fn as (s: AppStateStatus) => void;
      return { remove: jest.fn() } as never;
    });
    try {
      wrap(<V2Home />);
      await flush();
      expect(screen.getByText('ส. 3 ต.ค. 2569')).toBeTruthy();
      jest.setSystemTime(Date.UTC(2026, 9, 4, 1)); // Sun 4 Oct, 08:00 Bangkok
      act(() => onChange?.('active'));
      expect(screen.getByText('อา. 4 ต.ค. 2569')).toBeTruthy();
    } finally {
      spy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('says there is nothing to handle, rather than inventing rows', async () => {
    wrap(<V2Home />);
    await flush();
    expect(within(screen.getByTestId('home-to-know')).getByText('ยังไม่มีเรื่องที่ต้องรู้หรือจัดการ')).toBeTruthy();
    expect(screen.queryByTestId('home-open-sale')).toBeNull();
    expect(screen.queryByTestId('home-latest-sale')).toBeNull();
    expect(screen.queryByTestId('home-owed')).toBeNull();
    expect(screen.queryByTestId('home-payables')).toBeNull();
  });

  it('the module grid keeps its old order; garden care is a short tile beside รายการที่ต้องจ่าย; stock and tappers share a row (owner 2026-11-16, E16-S05 HM-4)', async () => {
    wrap(<V2Home />);
    await flush();
    const grid = screen.getByTestId('home-go-to');
    const ids = within(grid).getAllByTestId(/^mod-/).map((n) => n.props.testID);
    expect(ids).toEqual(['mod-reports', 'mod-weather', 'mod-payables', 'mod-care', 'mod-expenses', 'mod-order', 'mod-stock', 'mod-workers']);
    // The long รายการที่ต้องจ่าย row is now two short tiles: it and การดูแลสวน.
    const pair = within(screen.getByTestId('home-go-to-care-row')).getAllByTestId(/^mod-/).map((n) => n.props.testID);
    expect(pair).toEqual(['mod-payables', 'mod-care']);
    // Stock and tappers share one row as two short tiles (owner 2026-11-16, HM-4).
    const people = within(screen.getByTestId('home-go-to-stock-row')).getAllByTestId(/^mod-/).map((n) => n.props.testID);
    expect(people).toEqual(['mod-stock', 'mod-workers']);
    expect(within(screen.getByTestId('mod-care')).getByText('การดูแลสวน')).toBeTruthy();
    // The amount to pay moved to ควรรู้ (HM-3): the tile is a way in only.
    expect(within(screen.getByTestId('mod-payables')).queryByText('0.00')).toBeNull();
    expect(within(screen.getByTestId('mod-reports')).getByText('รายงานการขายย้อนหลัง')).toBeTruthy();
    expect(within(screen.getByTestId('mod-weather')).getByText('เปิดภายนอก')).toBeTruthy();
    expect(within(screen.getByTestId('mod-weather')).getByTestId('external-icon', { includeHiddenElements: true })).toBeTruthy();
    expect(within(screen.getByTestId('mod-expenses')).getByText('ค่าใช้จ่ายทั้งหมด')).toBeTruthy();
    expect(within(screen.getByTestId('mod-stock')).getByText('รายการ stock')).toBeTruthy();
    expect(within(screen.getByTestId('mod-workers')).getByText('0')).toBeTruthy();
    expect(within(screen.getByTestId('mod-workers')).getByText('คนกรีดยาง')).toBeTruthy();
  });

  it('every action and module opens its screen; selling leads to the sale routes', async () => {
    wrap(<V2Home />);
    await flush();
    const routes: Record<string, string> = {
      'home-prepare': '/v2/prepare',
      'home-sale-start': '/v2/sale/start',
      'home-record-expense': '/v2/expense/new',
      'mod-care': '/v2/care',
      'home-sales': '/v2/sales',
      'mod-reports': '/v2/reports',
      'mod-weather': '/v2/weather',
      'mod-payables': '/v2/payables',
      'mod-expenses': '/v2/expenses',
      'mod-order': '/v2/order',
      'mod-stock': '/v2/stock',
      'mod-workers': '/v2/people?filter=tapper',
    };
    for (const [id, href] of Object.entries(routes)) {
      fireEvent.press(screen.getByTestId(id));
      expect(mockRouter.push).toHaveBeenLastCalledWith(href);
    }
    expect(within(screen.getByTestId('home-sales')).getByText('ดูการขายทั้งหมด')).toBeTruthy();
  });
});

describe('V2Home — FarmMate originals (E03-S11 FM-6)', () => {
  it('the three actions and the module grid draw the originals; weather keeps its line icon', async () => {
    wrap(<V2Home />);
    await flush();
    expect(art('home-prepare')).toEqual(['farmwork.today']);
    expect(art('home-sale-start')).toEqual(['sale.sale']);
    expect(art('home-record-expense')).toEqual(['sale.receipt']);
    // A sprout for looking after the garden (owner 2026-11-16 asked for a better-fitting icon than the tools).
    expect(art('mod-care')).toEqual(['farm.treeCondition']);
    expect(art('mod-reports')).toEqual(['sale.salesReport']);
    expect(art('mod-weather')).toEqual([]);
    expect(art('mod-payables')).toEqual(['finance.expense']);
    expect(art('mod-expenses')).toEqual(['sale.receipt']);
    expect(art('mod-order')).toEqual(['materials.orderMaterials']);
    expect(art('mod-stock')).toEqual(['materials.stock']);
    expect(art('mod-workers')).toEqual(['people.workerInfo']);
  });

  it('the ☰ menu items draw the originals', async () => {
    wrap(<V2Home />);
    await flush();
    fireEvent.press(screen.getByTestId('open-menu'));
    expect(art('nav-farm')).toEqual(['farm.info']);
    expect(art('nav-expenses')).toEqual(['sale.receipt']);
    expect(art('nav-points')).toEqual(['farm.weighPoint']);
    expect(art('nav-shares')).toEqual(['people.profitShare']);
    expect(art('nav-debts')).toEqual(['finance.otherCost']);
    expect(art('nav-sales')).toEqual(['analysis.saleHistory']);
    expect(art('nav-device')).toEqual(['system.multiDevice']);
    expect(art('nav-sync')).toEqual(['system.sync']);
  });
});

describe('V2Home — ☰ menu (v1.1.0 screen 1)', () => {
  it('shows the shared group (ข้อมูลฟาร์ม with its facts, ค่าใช้จ่ายทั้งหมด) and this device', async () => {
    wrap(<V2Home />);
    await flush();
    expect(screen.queryByTestId('drawer')).toBeNull();
    fireEvent.press(screen.getByTestId('open-menu'));
    const drawer = screen.getByTestId('drawer');
    expect(within(drawer).getByText('ของกลุ่ม · ทุกเครื่องเห็นเหมือนกัน')).toBeTruthy();
    expect(within(drawer).getByText('เฉพาะเครื่องนี้ · ไม่ส่งไปเครื่องอื่น')).toBeTruthy();
    const farm = within(drawer).getByTestId('nav-farm');
    for (const fact of ['สวนและจุดชั่ง', 'คน · คนรับซื้อยาง', 'บัญชีรับเงิน', 'ตั้งค่าวันขาย']) expect(within(farm).getByText(fact)).toBeTruthy();
    const device = within(drawer).getByTestId('nav-device');
    for (const fact of ['ขนาดตัวอักษร', 'เวลากดค้าง', 'เสียง']) expect(within(device).getByText(fact)).toBeTruthy();
    expect(within(drawer).getByTestId('nav-expenses')).toBeTruthy();
  });

  it('every farm section is reachable from the home, the menu, or ข้อมูลฟาร์ม', async () => {
    wrap(<V2Home />);
    await flush();
    const pushed = new Set<string>();
    const press = (id: string) => {
      fireEvent.press(screen.getAllByTestId(id)[0]);
      pushed.add(String(mockRouter.push.mock.lastCall?.[0]).split('?')[0]);
    };
    for (const n of screen.getAllByTestId(/^(home|mod)-/)) if (['button', 'link'].includes(n.props.accessibilityRole)) press(n.props.testID);
    fireEvent.press(screen.getByTestId('open-menu'));
    const navIds: string[] = screen.getAllByTestId(/^nav-/).map((n) => n.props.testID);
    for (const id of navIds) {
      if (!screen.queryByTestId('drawer')) fireEvent.press(screen.getByTestId('open-menu'));
      press(id);
    }
    // ข้อมูลฟาร์ม (farm mockup 2) is where these live; the hub has its own test.
    const viaHub = ['farms', 'people', 'buyers', 'accounts', 'sale-settings'];
    expect(pushed).toContain('/v2/farm');
    for (const s of FARM_SECTIONS) if (!viaHub.includes(s.slug)) expect(pushed).toContain(sectionHref(s));
  });

  it('picking an item closes the menu and opens the screen', async () => {
    wrap(<V2Home />);
    await flush();
    fireEvent.press(screen.getByTestId('open-menu'));
    fireEvent.press(screen.getByTestId('nav-farm'));
    expect(screen.queryByTestId('drawer')).toBeNull();
    expect(mockRouter.push).toHaveBeenLastCalledWith('/v2/farm');
  });
});

describe('V2Home — garden care tile (E16-S05 HM-2)', () => {
  it('the garden care button says how many fertilizings are not split yet; deleted ones do not count', async () => {
    await seedUnsplitFertilizing('fz-a');
    await seedUnsplitFertilizing('fz-b');
    await seedUnsplitFertilizing('fz-gone', true);
    wrap(<V2Home />);
    await flush();
    expect(screen.getByTestId('mod-care-flag')).toHaveTextContent('ยังไม่แบ่ง 2 ครั้ง');
    fireEvent.press(screen.getByTestId('mod-care'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/v2/care');
  });
});

describe('V2Home — live rows from the local log', () => {
  it('shows the open sale, the latest finished sale, money owed back and the totals', async () => {
    await seedSale('s-old', 2, (b) => b.sys({ t: 'sale_closed' }));
    await seedSale('s-now', 3);
    await seedOwed('อาจารย์สมหวัง', 120_000);
    await mockPeople.create('แดง', ['tapper']);
    await mockPeople.create('นัด', ['tapper']);
    await mockPeople.create('อาจารย์สมหวัง', ['manager']);

    wrap(<V2Home />);
    await flush();

    const open = screen.getByTestId('home-open-sale');
    expect(within(open).getByText('การขายที่ยังไม่ปิด')).toBeTruthy();
    expect(within(open).getByText(/· 150 กก\.$/)).toBeTruthy();
    expect(within(open).getByText('กำลังชั่ง')).toBeTruthy();
    const latest = screen.getByTestId('home-latest-sale');
    expect(within(latest).getByText('การขายล่าสุด')).toBeTruthy();
    expect(within(latest).getByText(/· 100 กก\.$/)).toBeTruthy();
    expect(within(latest).getByText('ปิดแล้ว')).toBeTruthy();

    // E03-S11 FM-6: the rows draw the FarmMate originals.
    expect(art('home-open-sale')).toEqual(['sale.sale']);
    expect(art('home-latest-sale')).toEqual(['sale.sale']);
    expect(art('home-owed')).toEqual(['finance.workerPay']);
    const owed = screen.getByTestId('home-owed');
    expect(within(owed).getByText('เงินที่สวนต้องคืน')).toBeTruthy();
    expect(within(owed).getByText('1,200.00')).toBeTruthy();
    expect(within(owed).getByText('อาจารย์สมหวัง')).toBeTruthy();
    expect(screen.queryByText('ยังไม่มีเรื่องที่ต้องรู้หรือจัดการ')).toBeNull();

    // E16-S05 HM-3: money owed back is its own row; the payables row counts the shop only, so it does not repeat it.
    expect(screen.queryByTestId('home-payables')).toBeNull();
    expect(within(screen.getByTestId('mod-payables')).queryByText('1,200.00')).toBeNull();
    // E16-S05 HM-6: every ควรรู้ row says why it is there and what to do.
    expect(screen.getByTestId('home-open-sale-why')).toHaveTextContent('ชั่งอยู่ · ชั่งเสร็จแล้วจ่ายเงินและกดปิดการขาย');
    expect(screen.getByTestId('home-latest-sale-why')).toHaveTextContent('ดูยอดขายและเงินที่จ่ายแล้ว');
    expect(screen.getByTestId('home-owed-why')).toHaveTextContent('มีคนออกเงินให้สวนไปก่อน · คืนเงินเขา');
    expect(within(screen.getByTestId('mod-workers')).getByText('2')).toBeTruthy();

    // The open sale resumes at its counter, the latest one opens its payment (v2 sale flow).
    fireEvent.press(open);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/v2/sale/s-now/counter?point=p1');
    fireEvent.press(latest);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/v2/sale/s-old/payment');
    fireEvent.press(owed);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/v2/owed');
  });
});

describe('V2Home — shop orders (E11-S11 FO-13, FD-0)', () => {
  const fert = { type: 'chemical' as const, formula: 'ยูเรีย', brand: '', sackKg: null, reasons: [], zones: [], shop: 'ร้านสมศรี', orderedBy: '', sacks: 2, pricePerSackSatang: 50000, itemDiscountSatang: 0 };
  const seedFert = async (id: string, stage: 'actual' | 'committed', orderId: string, n: number) => {
    const e: FinanceEvent = {
      id: `ev-${id}`, groupId: 'group-1', deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: 'dev-other' }, source: 'app', targetId: id, baseEventId: null,
      payload: { t: 'expense_created', fields: { amountSatang: 100000, date: '2026-10-20', stage, categoryId: 'cat-fertilizer', propertyId: null, item: 'ยูเรีย', note: '', payer: null, orderId, fertilizer: fert } },
    };
    await mockFinance.append(e);
  };

  const withToday = async (utc: number, fn: () => Promise<void>) => {
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'setImmediate', 'nextTick', 'queueMicrotask'] });
    jest.setSystemTime(utc);
    try {
      await fn();
    } finally {
      jest.useRealTimers();
    }
  };

  it('asks whether an ordered fertilizer arrived (once overdue) and opens the order; no "no plot yet" reminder any more (E11-S17)', async () => {
    await seedFert('o1-a', 'committed', 'o1', 101);
    await seedFert('o2-a', 'actual', 'o2', 102);
    await seedFert('o2-b', 'actual', 'o2', 103);
    await withToday(Date.UTC(2026, 9, 23, 5), async () => {
      // ordered 20 Oct, today 23 Oct: 3 days, overdue
      wrap(<V2Home />);
      await flush();
      expect(within(screen.getByTestId('home-order-committed')).getByText(/ของมาแล้วหรือยัง/)).toBeTruthy();
      expect(screen.queryByTestId('home-order-zones')).toBeNull();
      expect(art('home-order-committed')).toEqual(['farmwork.fertilize']);
      expect(screen.getByTestId('home-order-committed-why')).toHaveTextContent('สั่งเกิน 2 วันแล้ว · ของมาแล้วให้เปลี่ยนเป็น ได้ของแล้ว');
      // E16-S05 HM-3: the shop is still owed for the committed order: one row, short money, with why.
      expect(screen.getByTestId('home-payables')).toHaveTextContent(/฿\s*1,000/);
      // What it sums is committed buying not paid yet, so the reason says that (review of PR 190 item 1).
      expect(screen.getByTestId('home-payables-why')).toHaveTextContent('สั่งหรือตกลงไว้แล้ว ยังไม่ได้จ่าย');
      fireEvent.press(screen.getByTestId('home-order-committed'));
      expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/v2/order/[orderId]', params: { orderId: 'o1' } });
      expect(screen.getByTestId('mod-order')).toBeTruthy();
    });
  });

  it('does not remind about an order placed 2 days ago or less', async () => {
    await seedFert('o1-a', 'committed', 'o1', 101);
    await withToday(Date.UTC(2026, 9, 22, 5), async () => {
      wrap(<V2Home />);
      await flush();
      expect(screen.queryByTestId('home-order-committed')).toBeNull();
    });
  });
});

describe('V2Home — a sale left open after weighing (E16-S05 HM-6)', () => {
  // Last in the file: the store is shared, and this open sale must not become the newest one for the tests above.
  it('says the sale is not closed yet and what closes it', async () => {
    // Weighed and the pile closed, but nobody pressed ปิดการขาย (owner's 3 Nov sale): the row says so.
    const b = setUpSale(new LogBuilder('s-left'));
    readyPile(b, 'p1');
    b.accept('p1').accept('p1').sys({ t: 'pile_closed', pileId: 'p1', forced: false });
    // Later than every sale the tests above left in the shared store, so it is the open one shown.
    for (const e of b.build() as SaleEvent[]) await mockStore.append({ ...e, ts: e.ts + 1_000_000_000 });
    wrap(<V2Home />);
    await flush();
    expect(screen.getByTestId('home-open-sale-why')).toHaveTextContent('ยังไม่ได้กดปิดการขาย · จ่ายเงินให้ครบแล้วกดปิด');
  });
});
