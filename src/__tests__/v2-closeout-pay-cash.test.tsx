import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { PixelRatio, Platform, Text } from 'react-native';

import { LogBuilder } from '../core/fixtures';
import { FARM_FUNDS } from '../core/finance/types';
import { financeStore } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { BuyerViewScreen, FitAmount } from '../v2/sale/closeout/buyer-view-screen';
import { CloseoutCashScreen } from '../v2/sale/closeout/cash-screen';
import { updateDraft, useCloseoutDraft } from '../v2/sale/closeout/use-closeout';

/**
 * E05-S11 · จัดเงินสดกับคนรับซื้อยาง (CO-19, CO-23, CO-24; A6, A11, A13, A17)
 * and ให้คนรับซื้อดู (CO-20; A7, A12, A18). Nothing is recorded yet: every
 * figure follows the in-memory draft.
 */

jest.mock('../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('../store/people', () => {
  const { MasterStore } = jest.requireActual('../store/master-store');
  const { createDeviceClock } = jest.requireActual('../store/device-clock');
  const { store } = jest.requireMock('../store/store');
  return { peopleStore: new MasterStore(store, createDeviceClock(store)) };
});
jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => true), dismissAll: jest.fn(), dismissTo: jest.fn() };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => ({}),
    useRouter: () => router,
    router,
  };
});

const master = () => (jest.requireMock('../store/people') as { peopleStore: MasterStore }).peopleStore;
const store = () => (jest.requireMock('../store/store') as { store: EventStore }).store;
const { router } = jest.requireMock('expo-router') as { router: Record<'push' | 'replace' | 'back' | 'dismissTo', jest.Mock> };

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}
const last = (id: string) => screen.getAllByTestId(id).pop()!;
const press = async (id: string) => {
  await act(async () => fireEvent.press(last(id)));
  await flush();
};
const FARM = { id: FARM_FUNDS, name: 'เงินสวน' };
let farm: MockFarm;

/** แดง `redFull` full baskets (+ 17.5 kg short when `fraction`), นัด 4 full (+ 10 kg short when `fraction`), 50 ฿/kg. */
async function sale(id: string, fraction: boolean) {
  const b = new LogBuilder(id);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 5000, indexRef: '' });
  for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
  for (let n = 1; n <= 7; n++) b.acceptAt(farm.a[0], n);
  if (fraction) b.shortAt(farm.a[0], 8, 19_500);
  for (let n = 1; n <= 4; n++) b.acceptAt(farm.a[3], n);
  if (fraction) b.shortAt(farm.a[3], 5, 12_000);
  await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
}

const inSale = async (saleId: string, ui: ReactElement) => {
  const r = wrap(<SaleProvider saleId={saleId}>{ui}</SaleProvider>);
  await flush();
  return r;
};

function DraftProbe({ saleId }: { saleId: string }) {
  const d = useCloseoutDraft(saleId);
  return d.cashStepDone ? <Text testID="probe-done">done</Text> : null;
}

const STORY = 'co-cash-story';
const WHOLE = 'co-cash-whole';

beforeAll(async () => {
  farm = await seedMockFarm(master());
  // แดง owes 3,250 (proposal: all of it); นัด owes 8,000 (proposal cut at his share).
  await writeFinance('debt-red', null, { t: 'debt_added', fields: { worker: { id: farm.red, name: 'แดง' }, kind: 'loan', amountSatang: 325_000, date: '2026-09-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
  await writeFinance('debt-nat', null, { t: 'debt_added', fields: { worker: { id: farm.nat, name: 'นัด' }, kind: 'loan', amountSatang: 800_000, date: '2026-09-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
  await sale(STORY, true);
  await sale(WHOLE, false);
});

describe('CO-19 · the cash step (A6): first time = โอนรวม + ให้คนกรีด', () => {
  it('one route row per worker with a deduction, in the menu order; rounding row with the fraction; the buyer pays the sale', async () => {
    await inSale(STORY, <CloseoutCashScreen />);
    expect(screen.getByTestId(`cop-who-${farm.red}`)).toHaveTextContent(/แดง\s*หัก 3,250\.00/);
    expect(screen.getByTestId(`cop-who-${farm.nat}`)).toHaveTextContent(/นัด\s*หัก 5,250\.00/);
    const seg = within(screen.getByTestId(`cop-route-${farm.red}`));
    expect(seg.getAllByRole('radio').map((r) => r.props.testID)).toEqual([
      `cop-route-${farm.red}-transfer-with-owner`,
      `cop-route-${farm.red}-buyer-split`,
      `cop-route-${farm.red}-cash-from-share`,
    ]);
    expect(screen.getByTestId(`cop-route-${farm.red}-cash-from-share`)).toHaveTextContent('หยิบจากเงินแดง');
    expect(screen.getByTestId(`cop-route-${farm.red}-transfer-with-owner`).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('cop-round-title')).toHaveTextContent(/ปัดเศษ\s*แดงมีเศษ 0\.50/);
    expect(within(screen.getByTestId('cop-round')).getAllByRole('radio').map((r) => r.props.testID)).toEqual(['cop-round-worker', 'cop-round-none', 'cop-round-owner']);
    expect(screen.getByTestId('cop-round-worker').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId(`cop-cash-${farm.red}`)).toHaveTextContent(/เงินสดแดง\s*5,938\.00/);
    expect(screen.getByTestId(`cop-cash-${farm.nat}`)).toHaveTextContent(/เงินสดนัด\s*0\.00/);
    expect(screen.getByTestId('cop-transfer')).toHaveTextContent(/โอนเข้าบัญชีสวน\s*22,937\.00/);
    expect(screen.getByTestId('cop-transfer-split')).toHaveTextContent(/ส่วนสวน 14,437\.00 \+ ↘ คืนหนี้ 8,500\.00/);
    expect(screen.getByTestId('cop-total')).toHaveTextContent(/รวม = ขายวันนี้\s*28,875\.00/);
    // nothing is written on this page
    expect((await financeStore.load()).filter((e) => e.payload.t !== 'debt_added')).toHaveLength(0);
  });

  it('a route change updates "ต้องจ่าย" live (A17): buyer-split gets its own cash line', async () => {
    await inSale(STORY, <CloseoutCashScreen />);
    await press(`cop-route-${farm.red}-buyer-split`);
    expect(last(`cop-route-${farm.red}-buyer-split`).props.accessibilityState).toMatchObject({ checked: true });
    expect(last(`cop-split-${farm.red}`)).toHaveTextContent(/↘ เงินสดคืนหนี้แดง.*3,250\.00/);
    expect(last('cop-transfer')).toHaveTextContent(/19,687\.00/);
    expect(last('cop-transfer-split')).toHaveTextContent(/ส่วนสวน 14,437\.00 \+ ↘ คืนหนี้นัด 5,250\.00/);
    expect(last('cop-total')).toHaveTextContent(/28,875\.00/);
    // put it back for the next cases
    await press(`cop-route-${farm.red}-transfer-with-owner`);
  });

  it('CO-24: หยิบจากเงินแดง that needs a note broken shows "⚠ ต้องแตกเงิน"; the sheet (A11)', async () => {
    await inSale(STORY, <CloseoutCashScreen />);
    expect(screen.queryByTestId(`cop-break-${farm.red}`)).toBeNull();
    await press('cop-round-none');
    await press(`cop-route-${farm.red}-cash-from-share`);
    expect(last(`cop-break-${farm.red}`)).toHaveTextContent(/ต้องแตกเงิน/);
    await press(`cop-break-${farm.red}`);
    const sheet = last('cop-break-sheet');
    expect(sheet).toHaveTextContent(/เงินของแดง ฿ 9,187\.50/);
    expect(sheet).toHaveTextContent(/฿1,000 ×9/);
    expect(sheet).toHaveTextContent(/สวนหยิบ ฿ 3,250/);
    expect(sheet).toHaveTextContent(/เงินย่อยมีแค่ ฿187\.50 ขาด ฿62\.50/);
    expect(sheet).toHaveTextContent(/ขอให้คนรับซื้อยางแตก/);
    expect(sheet).toHaveTextContent(/฿500 ×1/);
    expect(sheet).toHaveTextContent(/฿100 ×4/);
    expect(sheet).toHaveTextContent(/฿50 ×2/);
    await press('cop-break-close');
    expect(screen.queryByTestId('cop-break-sheet')).toBeNull();
    await press(`cop-route-${farm.red}-transfer-with-owner`);
    await press('cop-round-worker');
  });

  it('ตกลง marks the step done and goes back; ให้คนรับซื้อดู opens the buyer view', async () => {
    router.back.mockClear();
    router.push.mockClear();
    await inSale(STORY, <><CloseoutCashScreen /><DraftProbe saleId={STORY} /></>);
    expect(screen.queryByTestId('probe-done')).toBeNull();
    await press('cop-buyer-view');
    expect(router.push).toHaveBeenCalledWith(`/v2/sale/${STORY}/buyer-view`);
    await press('cop-ok');
    expect(screen.getByTestId('probe-done')).toBeTruthy();
    expect(router.back).toHaveBeenCalled();
  });
});

describe('CO-19 · no fraction, no deduction', () => {
  it('whole baht: no rounding row', async () => {
    await inSale(WHOLE, <CloseoutCashScreen />);
    expect(screen.getByTestId(`cop-who-${farm.red}`)).toBeTruthy();
    expect(screen.queryByTestId('cop-round')).toBeNull();
  });

  it('nobody deducted: no route section', async () => {
    updateDraft(WHOLE, (d) => ({ ...d, workers: { [farm.red]: { totalSatang: 0 }, [farm.nat]: { totalSatang: 0 } } }));
    await inSale(WHOLE, <CloseoutCashScreen />);
    expect(screen.queryByTestId('cop-routes')).toBeNull();
    expect(screen.getByTestId('cop-total')).toHaveTextContent(/27,500\.00/);
  });
});

describe('CO-20 · ให้คนรับซื้อดู', () => {
  it('a pile per worker, the transfer with its split and the total, with their symbols', async () => {
    await inSale(STORY, <BuyerViewScreen />);
    expect(screen.getByTestId(`bv-cash-${farm.red}`)).toHaveTextContent(/฿.*เงินสด · แดง.*5,938\.00/);
    expect(screen.getByTestId('bv-transfer')).toHaveTextContent(/⇄.*โอนเข้าบัญชีสวน.*22,937\.00/);
    expect(screen.getByTestId('bv-transfer')).toHaveTextContent(/ส่วนสวน 14,437\.00 \+ ↘ คืนหนี้ 8,500\.00/);
    expect(screen.getByTestId('bv-total')).toHaveTextContent(/Σ.*รวม.*28,875\.00/);
  });

  it('2,345,678.00 at the largest text size: whole, on one line, shrunk to the width', async () => {
    const scale = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    wrap(<FitAmount satang={234_567_800} testID="fit" />);
    const box = screen.getByTestId('fit');
    await act(async () => fireEvent(box, 'layout', { nativeEvent: { layout: { width: 358, height: 60, x: 0, y: 0 } } }));
    const text = screen.getByTestId('fit-text');
    expect(text).toHaveTextContent('2,345,678.00');
    expect(text.props.children).not.toMatch(/…/);
    const style = [text.props.style].flat().reduce((a, s) => ({ ...a, ...s }), {}) as { fontSize: number };
    // the drawn width (fontSize × the system scale × ~0.62 em per figure) fits the 358 px line
    expect(style.fontSize * 2 * 0.62 * '2,345,678.00'.length).toBeLessThanOrEqual(358);
    if (Platform.OS !== 'web') expect(text.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
    scale.mockRestore();
  });
});
