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
const { router: mockRouter } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };

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

beforeEach(() => mockRouter.push.mockClear());

/**
 * The v2 home (e03-v2-splash-home): flow-v1 screen 3 with the v1.1.0
 * screens 1 and 25 on top. Runs first on empty stores, then seeds them.
 */
describe('V2Home — empty farm', () => {
  it('reads top to bottom as drawn: header with date, cover, three actions, ควรรู้, ไปที่', async () => {
    wrap(<V2Home />);
    await flush();
    expect(screen.getByTestId('screen-title').props.children).toBe('หน้าแรก');
    expect(screen.getByText(/^(อา|จ|อ|พ|พฤ|ศ|ส)\. \d{1,2} \S+ \d{4}$/)).toBeTruthy();
    expect(screen.getByLabelText('ภาพปก: สวนยางยามเช้า')).toBeTruthy();

    const home = screen.getByTestId('v2-home');
    const order = ['home-cover', 'home-prepare', 'home-sale-start', 'home-record-expense', 'home-to-know', 'home-sales', 'home-go-to'];
    const all = within(home).getAllByTestId(new RegExp(`^(${order.join('|')})$`));
    expect(all.map((n) => n.props.testID)).toEqual(order);

    expect(within(screen.getByTestId('home-prepare')).getByText('เตรียมขาย')).toBeTruthy();
    expect(within(screen.getByTestId('home-sale-start')).getByText('เริ่มการขาย')).toBeTruthy();
    expect(within(screen.getByTestId('home-record-expense')).getByText('บันทึกค่าใช้จ่าย')).toBeTruthy();
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
  });

  it('the module grid follows v1.1.0 screen 25, with zero totals', async () => {
    wrap(<V2Home />);
    await flush();
    const grid = screen.getByTestId('home-go-to');
    const ids = within(grid).getAllByTestId(/^mod-/).map((n) => n.props.testID);
    expect(ids).toEqual(['mod-reports', 'mod-weather', 'mod-payables', 'mod-expenses', 'mod-stock', 'mod-workers']);
    expect(within(screen.getByTestId('mod-reports')).getByText('รายงานการขายย้อนหลัง')).toBeTruthy();
    expect(within(screen.getByTestId('mod-weather')).getByText('เปิดภายนอก')).toBeTruthy();
    expect(within(screen.getByTestId('mod-weather')).getByTestId('external-icon', { includeHiddenElements: true })).toBeTruthy();
    expect(within(screen.getByTestId('mod-payables')).getByText('0.00')).toBeTruthy();
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
      'home-sales': '/v2/sales',
      'mod-reports': '/v2/reports',
      'mod-weather': '/v2/weather',
      'mod-payables': '/v2/payables',
      'mod-expenses': '/v2/expenses',
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

    const owed = screen.getByTestId('home-owed');
    expect(within(owed).getByText('เงินที่สวนต้องคืน')).toBeTruthy();
    expect(within(owed).getByText('1,200.00')).toBeTruthy();
    expect(within(owed).getByText('อาจารย์สมหวัง')).toBeTruthy();
    expect(screen.queryByText('ยังไม่มีเรื่องที่ต้องรู้หรือจัดการ')).toBeNull();

    expect(within(screen.getByTestId('mod-payables')).getByText('1,200.00')).toBeTruthy();
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
