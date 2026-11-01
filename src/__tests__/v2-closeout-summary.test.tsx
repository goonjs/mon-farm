import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { LogBuilder } from '../core/fixtures';
import { FARM_FUNDS } from '../core/finance/types';
import { financeStore } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { tokens } from '../../design/tokens';
import { wrap } from '../test/render';
import { clearDraft } from '../v2/sale/closeout/use-closeout';
import { CloseoutSummaryScreen } from '../v2/sale/closeout/summary-screen';

// Each case renders whole close-out screens and writes to the finance log: 1–2 s here, 3–4× slower on
// a CI runner, where jest's 5 s default timed out a first case and the shared fixture failed the rest.
jest.setTimeout(20_000);

/**
 * E05-S11 · สรุปจ่ายเงิน, the story's example (mockup A1–A5, A8, A22–A26):
 * ขาย 28,875.00 · แดง ส่วนแบ่ง 9,187.50, หนี้ 6,000 / 5,790 / 4,000 ผ่อนงวดละ
 * 3,250 · นัด ส่วนแบ่ง 5,250.00, หนี้ 7,350 / 1,000 · สวน 14,437.50 · สวนค้างจ่ายนัด 640.
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
const router = () => (jest.requireMock('expo-router') as { router: { push: jest.Mock } }).router;

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}
const press = async (id: string) => {
  await act(async () => fireEvent.press(screen.getByTestId(id)));
  await flush();
};
const keys = async (digits: string) => {
  for (const d of digits) await press(`co-pad-key-${d}`);
};
const text = (id: string) => screen.getByTestId(id);
const disabled = (id: string) => !!screen.getByTestId(id).props.accessibilityState?.disabled;

const SALE = 'sale-co';
const inSale = async (ui: ReactElement) => {
  const r = wrap(<SaleProvider saleId={SALE}>{ui}</SaleProvider>);
  await flush();
  return r;
};
const FARM = { id: FARM_FUNDS, name: 'เงินสวน' };
const all = async () => financeStore.load();
const count = async (t: string) => (await all()).filter((e) => e.payload.t === t).length;

let farm: MockFarm;

beforeAll(async () => {
  farm = await seedMockFarm(master());
  const b = new LogBuilder(SALE);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 5250, indexRef: '' });
  for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
  // แดง 350 กก. (7 เข่ง) · นัด 200 กก. (4 เข่ง) at 52.50 = 28,875.00
  for (let n = 1; n <= 7; n++) b.acceptAt(farm.a[0], n);
  for (let n = 1; n <= 4; n++) b.acceptAt(farm.a[3], n);
  await seedSale(store(), b.build().map((e) => ({ ...e, ts: Date.now() })));
  const RED = { id: farm.red, name: 'แดง' };
  const NAT = { id: farm.nat, name: 'นัด' };
  const loan = (worker: typeof RED, amountSatang: number, date: string) => ({ t: 'debt_added' as const, fields: { worker, kind: 'loan' as const, amountSatang, date, note: '', lender: FARM, fertilizer: null, carriedForward: false } });
  const fert = (worker: typeof RED, amountSatang: number, date: string) => ({
    t: 'debt_added' as const,
    fields: { worker, kind: 'fertilizer' as const, amountSatang, date, note: '', lender: null, fertilizer: { totalSatang: amountSatang * 2, workerPct: 50 }, carriedForward: false },
  });
  await writeFinance('d-red-1', null, loan(RED, 600_000, '2026-09-01'));
  await writeFinance('d-red-2', null, fert(RED, 579_000, '2026-09-28'));
  await writeFinance('d-red-3', null, fert(RED, 400_000, '2026-10-05'));
  await writeFinance('plan-red', null, { t: 'debt_plan_set', worker: RED, perSaleSatang: 325_000 });
  await writeFinance('d-nat-1', null, fert(NAT, 735_000, '2026-10-05'));
  await writeFinance('d-nat-2', null, loan(NAT, 100_000, '2026-10-20'));
  // the farm owes นัด 640 (นัด paid a fertilizer bill for the farm)
  await writeFinance('exp-nat', null, { t: 'expense_created', fields: { amountSatang: 64_000, date: '2026-10-25', stage: 'actual', categoryId: null, propertyId: null, item: 'ค่าปุ๋ย', note: '', payer: NAT } });
});

beforeEach(() => {
  clearDraft(SALE);
  router().push.mockClear();
});

describe('สรุปจ่ายเงิน · the proposal on one page (CO-1, CO-2, CO-3, CO-4)', () => {
  it('shows the sale strip, the debt card, the owed card, one card per tapper, the cash card and the tally bar', async () => {
    await inSale(<CloseoutSummaryScreen />);
    expect(text('co-progress')).toHaveTextContent(/ขั้น 2 จาก 3/);
    expect(text('co-sale-strip')).toHaveTextContent(/ขายวันนี้.*28,875\.00/);
    expect(text('co-debt-card')).toHaveTextContent(/หนี้ค้างของคนกรีด/);
    expect(text('co-owed-card')).toHaveTextContent(/สวนค้างจ่ายคนกรีด/);
    expect(text(`co-worker-${farm.red}`)).toHaveTextContent(/แดง.*ส่วนแบ่ง 9,187\.50/);
    expect(text(`co-worker-${farm.nat}`)).toHaveTextContent(/นัด.*ส่วนแบ่ง 5,250\.00/);
    expect(text('co-cash-card')).toHaveTextContent(/จัดเงินสดกับคนรับซื้อยาง/);
    expect(text('co-tally')).toHaveTextContent(/ตรงถึงสตางค์/);
  });

  it('proposes the plan instalment for แดง and the whole share for นัด, rounded to the tapper first time', async () => {
    await inSale(<CloseoutSummaryScreen />);
    expect(text(`co-cash-${farm.red}`)).toHaveTextContent('5,938.00');
    expect(text(`co-cash-note-${farm.red}`)).toHaveTextContent(/เงินสด · ปัด \+0\.50/);
    expect(text(`co-deduct-${farm.red}`)).toHaveTextContent(/หักหนี้ · เก่าก่อน.*−3,250\.00/);
    expect(text(`co-cash-${farm.nat}`)).toHaveTextContent('0.00');
    expect(text(`co-cash-note-${farm.nat}`)).toHaveTextContent('เงินสดที่ต้องจ่าย');
    expect(text(`co-deduct-${farm.nat}`)).toHaveTextContent(/−5,250\.00/);
    // CO-4: cash 0 with debt left → a yellow chip with ⚠ and words, not colour alone
    expect(text(`co-left-${farm.nat}`)).toHaveTextContent(/หนี้ยังเหลือ 3,100$/);
    expect(screen.getByTestId(`co-left-${farm.nat}-mark`, { includeHiddenElements: true })).toBeTruthy();
    expect(text(`co-left-${farm.nat}`)).not.toHaveTextContent(/3,100\.00/);
    expect(screen.queryByTestId(`co-left-${farm.red}`)).toBeNull();
  });

  it('the debt card counts pieces per tapper and the short total (CO-21)', async () => {
    await inSale(<CloseoutSummaryScreen />);
    expect(text('co-debt-badge')).toHaveTextContent('2');
    expect(text('co-debt-card')).toHaveTextContent(/แดง.*หนี้ 3 ก้อน/);
    expect(text('co-debt-card')).toHaveTextContent(/นัด.*หนี้ 2 ก้อน/);
    expect(text('co-debt-total')).toHaveTextContent(/Σ.*รวม.*฿ 24\.14k/);
    expect(text('co-owed-card')).toHaveTextContent(/นัด.*↗.*ค้างจ่าย.*฿ 640/);
    expect(text('co-debt-open').props.accessibilityLabel).toBeTruthy();
  });

  it('short money keeps ฿ with its digits and the unit on a pill (summary-lines)', async () => {
    await inSale(<CloseoutSummaryScreen />);
    const pill = (id: string) => [text(id).props.style].flat(Infinity).filter(Boolean).reduce((a: object, x: object) => ({ ...a, ...x }), {}) as { backgroundColor?: string };
    expect(text('co-debt-total-money')).toHaveTextContent('฿ 24.14k');
    expect(pill('co-debt-total-money-unit').backgroundColor).toBeTruthy();
    // D-85: the farm's share and the debt repaid are never one figure; the share before rounding, the rounding its own part.
    expect(screen.queryByTestId('co-cash-transfer')).toBeNull();
    expect(text('co-cash-owner')).toHaveTextContent('฿ 14.44k');
    expect(pill('co-cash-owner-unit').backgroundColor).toBeTruthy();
    expect(text('co-cash-round')).toHaveTextContent('฿ 0.5');
    expect(text('co-cash-repay')).toHaveTextContent('฿ 8,500');
    expect(text('co-cash-split')).toHaveTextContent(/^โอนรวม · โอนสวน ฿ 14\.44k − ปัด ฿ 0\.5 \+ ↘ คืนหนี้ ฿ 8,500$/);
    expect(pill('co-cash-repay-label')).toMatchObject({ color: tokens.color.light.debtIn });
  });

  it('confirm is off and says which cards are still open (CO-17, CO-26)', async () => {
    await inSale(<CloseoutSummaryScreen />);
    expect(disabled('co-confirm')).toBe(true);
    expect(text('co-confirm')).toHaveTextContent('↑ ตรวจการ์ดด้านบนทั้ง 2 ใบก่อน');
  });
});

describe('the debt sheet (A2, CO-22)', () => {
  it('lists each tapper\'s pieces oldest first with what is left, and the reason under the name', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press('co-debt-open');
    const red = within(text(`co-debt-row-${farm.red}`));
    expect(red.getByText(/หักตามงวดผ่อน/)).toBeTruthy();
    expect(text(`co-debt-row-${farm.red}`)).toHaveTextContent(/−3,250\.00/);
    expect(text(`co-debt-row-${farm.red}`)).toHaveTextContent(/คงเหลืออีก 12,540\.00/);
    expect(text(`co-debt-row-${farm.red}`)).toHaveTextContent(/6,000\.00.*เหลือ 2,750\.00.*5,790\.00.*เหลือ 5,790\.00.*4,000\.00.*เหลือ 4,000\.00/);
    expect(within(text(`co-debt-row-${farm.nat}`)).getByText(/หักเต็มส่วนแบ่ง/)).toBeTruthy();
    expect(text(`co-debt-row-${farm.nat}`)).toHaveTextContent(/คงเหลืออีก 3,100\.00/);
  });

  it('ถูกต้อง checks every tapper: the card turns to ตรวจหนี้แล้ว with the short lines, the gate moves to the owed card', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press('co-debt-open');
    await press('co-debt-ok');
    expect(screen.queryByTestId('co-debt-badge')).toBeNull();
    expect(text('co-debt-card')).toHaveTextContent(/ตรวจหนี้แล้ว/);
    expect(text(`co-debt-line-${farm.red}`)).toHaveTextContent(/แดง.*↘.*หัก.*฿ 3,250.*คงเหลืออีก.*฿ 12\.54k/);
    expect(text(`co-debt-line-${farm.nat}`)).toHaveTextContent(/นัด.*↘.*หัก.*฿ 5,250.*คงเหลืออีก.*฿ 3,100/);
    expect(text('co-confirm')).toHaveTextContent('↑ ตรวจการ์ดสวนค้างจ่ายก่อน');
  });
});

describe('every sheet has a ✕ "ปิด" (A2, A5, A8)', () => {
  it.each([
    ['co-debt-open', 'co-debt-sheet'],
    ['co-sources-open', 'co-sources-sheet'],
    ['co-owed-open', 'co-owed-sheet'],
    ['co-sale-open', 'co-sale-sheet'],
  ])('%s → %s', async (open, sheet) => {
    await inSale(<CloseoutSummaryScreen />);
    await press(open);
    expect(text(`${sheet}-close`).props.accessibilityLabel).toBe('ปิด');
    await press(`${sheet}-close`);
    expect(screen.queryByTestId(sheet)).toBeNull();
  });

  it('the deduct sheet ✕ closes it like the scrim (the draft goes back)', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    await keys('3000');
    expect(text('co-deduct-sheet-close').props.accessibilityLabel).toBe('ปิด');
    await press('co-deduct-sheet-close');
    expect(screen.queryByTestId('co-deduct-sheet')).toBeNull();
    expect(text(`co-cash-${farm.nat}`)).toHaveTextContent('0.00');
  });
});

describe('the deduct sheet (A5, CO-5, CO-7, A22, A23)', () => {
  it('quick chips and the number pad change the cash and what is left at once; nothing is written', async () => {
    const before = (await all()).length;
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    expect(text('co-deduct-sheet')).toHaveTextContent(/หักหนี้นัดกี่บาท/);
    expect(text('co-quick-full')).toHaveTextContent(/หักเต็ม 5,250/);
    expect(text('co-quick-half')).toHaveTextContent(/ครึ่งหนึ่ง 2,625/);
    await keys('3000');
    expect(text('co-amount')).toHaveTextContent(/3,000/);
    expect(text('co-res-cash')).toHaveTextContent(/2,250\.00/);
    expect(text('co-res-oldest')).toHaveTextContent(/ก้อนเก่าสุด.*เหลือ.*4,350\.00/);
    expect(text('co-res-left')).toHaveTextContent(/5,350\.00/);
    await press('co-quick-none');
    expect(text('co-res-cash')).toHaveTextContent(/5,250\.00/);
    expect((await all()).length).toBe(before);
  });

  it('above the cap ✓ is off and the cap is said', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    await keys('6000');
    expect(disabled('co-deduct-ok')).toBe(true);
    expect(text('co-cap')).toHaveTextContent(/5,250\.00/);
  });

  it('✓ keeps the amount and counts as checking that tapper\'s debt (A22)', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    await keys('3000');
    await press('co-deduct-ok');
    expect(screen.queryByTestId('co-deduct-sheet')).toBeNull();
    expect(text(`co-cash-${farm.nat}`)).toHaveTextContent('2,250.00');
    expect(text('co-debt-badge')).toHaveTextContent('1');
    expect(text('co-confirm')).toHaveTextContent('↑ ตรวจการ์ดด้านบนทั้ง 2 ใบก่อน');
  });

  it('closing the sheet without ✓ puts the proposal back', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    await keys('3000');
    await press('co-deduct-sheet-scrim');
    expect(text(`co-cash-${farm.nat}`)).toHaveTextContent('0.00');
    expect(text('co-debt-badge')).toHaveTextContent('2');
  });

  it('netting is a link for a tapper the farm owes, with a sentence; used, the cap grows and the owed card is checked (CO-7)', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.red}`);
    expect(screen.queryByTestId('co-net-link')).toBeNull();
    await press('co-deduct-sheet-scrim');
    await press(`co-deduct-${farm.nat}`);
    expect(text('co-net-link')).toHaveTextContent(/↗ หักกลบ: ใช้ 640 ที่สวนค้างจ่ายนัด หักหนี้/);
    await press('co-net-link');
    expect(text('co-net-on')).toHaveTextContent(/ใช้ 640 ที่สวนค้างจ่ายนัด/);
    expect(text('co-amount')).toHaveTextContent(/5,890/);
    await press('co-deduct-ok');
    expect(text(`co-net-${farm.nat}`)).toHaveTextContent(/หักกลบ · สวนคืนนัด.*\+640\.00/);
    expect(text(`co-left-${farm.nat}`)).toHaveTextContent(/2,460/);
    expect(text('co-owed-card')).toHaveTextContent(/นัด.*↗.*หักกลบ.*฿ 640/);
    expect(screen.queryByTestId('co-owed-badge')).toBeNull();
    expect(text('co-confirm')).toHaveTextContent('↑ ตรวจหนี้ของแดงก่อน');
  });
});

describe('partial netting (owner Q1, CO-7): two amount boxes, one pad, one box edited at a time (A23)', () => {
  const selected = (id: string) => !!text(id).props.accessibilityState?.selected;
  const back = async (n: number) => {
    for (let i = 0; i < n; i++) await press('co-pad-key-back');
  };
  const SENTENCE = /ใช้ (\d+) ที่สวนค้างจ่ายนัด ลดหนี้นัด ไม่มีเงินสดเปลี่ยนมือ/;

  it('with netting the deduction box is the one typed into, said in words and outlined; tapping the netting box moves the pad there', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    // one box, no "กำลังแก้" needed
    expect(screen.queryByTestId('co-editing')).toBeNull();
    await press('co-net-link');
    expect(text('co-net-field')).toHaveTextContent(/640/);
    expect(text('co-amount')).toHaveTextContent(/5,890/);
    expect(selected('co-amount')).toBe(true);
    expect(selected('co-net-field')).toBe(false);
    expect(text('co-editing')).toHaveTextContent('กำลังแก้: ยอดหัก');
    // CO-15: the sentence next to หักกลบ
    expect(text('co-net-on')).toHaveTextContent(SENTENCE);
    expect(text('co-net-on')).toHaveTextContent(/ใช้ 640 ที่/);
    await press('co-net-field');
    expect(selected('co-net-field')).toBe(true);
    expect(selected('co-amount')).toBe(false);
    expect(text('co-editing')).toHaveTextContent('กำลังแก้: ยอดหักกลบ');
    // the chips follow the box being edited
    expect(screen.queryByTestId('co-quick-full')).toBeNull();
    expect(text('co-net-remove')).toBeTruthy();
    // the first key replaces the old amount; the deduction follows (route part kept)
    await keys('300');
    expect(text('co-net-field')).toHaveTextContent(/300/);
    expect(text('co-amount')).toHaveTextContent(/5,550/);
    expect(text('co-net-on')).toHaveTextContent(/ใช้ 300 ที่/);
    await press('co-amount');
    expect(text('co-editing')).toHaveTextContent('กำลังแก้: ยอดหัก');
    expect(text('co-quick-full')).toHaveTextContent(/หักเต็ม 5,550/);
    await keys('5000');
    expect(text('co-amount')).toHaveTextContent(/5,000/);
    expect(text('co-net-field')).toHaveTextContent(/300/);
    await press('co-deduct-ok');
    expect(text(`co-net-${farm.nat}`)).toHaveTextContent(/\+300\.00/);
    expect(text(`co-deduct-${farm.nat}`)).toHaveTextContent(/−5,000\.00/);
  });

  it('above the ceiling (640) the netting box says so and ตกลง is off; the chip sets the full amount; เอาออก removes it', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    await press('co-net-link');
    await press('co-net-field');
    expect(screen.queryByTestId('co-net-full')).toBeNull();
    await keys('700');
    expect(text('co-net-error')).toHaveTextContent(/หักกลบได้ไม่เกิน 640/);
    expect(disabled('co-deduct-ok')).toBe(true);
    // each key applies live while it is within the ceiling (7, 70); 700 is not applied: the draft keeps 70
    expect(text('co-amount')).toHaveTextContent(/5,320/);
    await back(3);
    await keys('62');
    expect(screen.queryByTestId('co-net-error')).toBeNull();
    expect(text('co-net-field')).toHaveTextContent(/62/);
    expect(text('co-net-full')).toHaveTextContent(/เต็ม 640/);
    await press('co-net-full');
    expect(text('co-net-field')).toHaveTextContent(/640/);
    await press('co-net-remove');
    expect(screen.queryByTestId('co-net-field')).toBeNull();
    expect(screen.queryByTestId('co-editing')).toBeNull();
    expect(text('co-amount')).toHaveTextContent(/5,250/);
    expect(text('co-net-link')).toBeTruthy();
  });

  it('the netting row on the summary and the checked owed card carry the short sentence (CO-15, A24)', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    await press('co-net-link');
    await press('co-deduct-ok');
    // the amount and where it comes from are on the same line; the short form says the rest (no cash changes hands)
    expect(text(`co-net-${farm.nat}`)).toHaveTextContent(/ใช้ลดหนี้นัด ไม่มีเงินสดเปลี่ยนมือ/);
    expect(text(`co-owed-line-${farm.nat}`)).toHaveTextContent(/หักกลบ.*฿ 640.*ใช้ลดหนี้นัด ไม่มีเงินสดเปลี่ยนมือ/);
  });
});

describe('screen readers hear the content, not a label that hides it (review #11)', () => {
  it('the deduct row says whose, how much and the ⚠ chip; the cash card says the route and both parts of the transfer', async () => {
    await inSale(<CloseoutSummaryScreen />);
    const label = (id: string) => String(text(id).props.accessibilityLabel ?? '');
    expect(label(`co-deduct-${farm.nat}`)).toMatch(/นัด/);
    expect(label(`co-deduct-${farm.nat}`)).toMatch(/5,250\.00/);
    expect(label(`co-deduct-${farm.nat}`)).toMatch(/หนี้ยังเหลือ 3,100/);
    expect(label(`co-deduct-${farm.red}`)).toMatch(/3,250\.00/);
    expect(label('co-cash-card')).toMatch(/จัดเงินสดกับคนรับซื้อยาง/);
    expect(label('co-cash-card')).toMatch(/โอนรวม/);
    expect(label('co-cash-card')).toMatch(/14,437\.50/);
    expect(label('co-cash-card')).toMatch(/คืนหนี้ 8,500\.00/);
  });

  it('the red count says what it counts', async () => {
    await inSale(<CloseoutSummaryScreen />);
    expect(text('co-debt-badge').props.accessibilityLabel).toBe('ยังไม่ตรวจ 2 คน');
    expect(text('co-owed-badge').props.accessibilityLabel).toBe('ยังไม่ตรวจ 1 คน');
  });

  it('the owed sheet\'s two radios sit in a radiogroup', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press('co-owed-open');
    const group = text(`co-owed-choice-${farm.nat}`);
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
  });
});

describe('the owed sheet (A26, CO-26)', () => {
  it('ไว้ก่อน / หักกลบ are radios that say which is checked (role + checked; web gets aria-checked, checked on the build)', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press('co-owed-open');
    const state = (id: string) => text(id).props.accessibilityState;
    expect(text(`co-owed-hold-${farm.nat}`).props.role).toBe('radio');
    expect(state(`co-owed-hold-${farm.nat}`)).toMatchObject({ checked: true });
    expect(state(`co-owed-net-${farm.nat}`)).toMatchObject({ checked: false });
    await press(`co-owed-net-${farm.nat}`);
    expect(state(`co-owed-net-${farm.nat}`)).toMatchObject({ checked: true });
    expect(state(`co-owed-hold-${farm.nat}`)).toMatchObject({ checked: false });
  });

  it('ไว้ก่อน is the default; ถูกต้อง checks the card and keeps the hold', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press('co-owed-open');
    expect(text('co-owed-sheet')).toHaveTextContent(/640\.00/);
    expect(text(`co-owed-hold-${farm.nat}`).props.accessibilityState?.selected).toBe(true);
    await press('co-owed-ok');
    expect(text('co-owed-card')).toHaveTextContent(/นัด.*↗.*ค้างจ่าย.*฿ 640.*ไว้ก่อน/);
    expect(text('co-confirm')).toHaveTextContent('↑ ตรวจหนี้ของแดงและนัดก่อน');
  });

  it('หักกลบกับหนี้นัด adds 640 to นัด\'s deduction', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press('co-owed-open');
    await press(`co-owed-net-${farm.nat}`);
    await press('co-owed-ok');
    expect(text(`co-deduct-${farm.nat}`)).toHaveTextContent(/−5,890\.00/);
    expect(text(`co-net-${farm.nat}`)).toHaveTextContent(/\+640\.00/);
  });
});

describe('sheets that only show (CO-9, CO-18)', () => {
  it('ดูที่มา opens the three checks of D-85 and the money really paid', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press('co-sources-open');
    const s = text('co-sources-sheet');
    expect(s).toHaveTextContent(/ที่มาของเงินแต่ละก้อน/);
    expect(s).toHaveTextContent(/ส่วนแบ่งแดง.*9,187\.50/);
    expect(s).toHaveTextContent(/ส่วนของสวน.*14,437\.50/);
    expect(s).toHaveTextContent(/แดง.*↘.*จ่ายหนี้.*−3,250\.00/);
    expect(s).toHaveTextContent(/โอนเข้าบัญชีสวน.*22,937\.00/);
    expect(s).toHaveTextContent(/28,875\.00/);
  });

  it('② as A8: a row per tapper, ONE "↘ สวนรับคืนหนี้" row, the "หนี้ลด = สวนได้คืน" line; ③ names สวน; the transfer told apart', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press('co-sources-open');
    const debt = text('co-src-debt');
    expect(debt).toHaveTextContent(/ไม่ใช่ยอดขาย · หนี้ลด 8,500 = สวนได้คืน 8,500/);
    expect(debt).toHaveTextContent(/แดง ↘ จ่ายหนี้\s*−3,250\.00\s*นัด ↘ จ่ายหนี้\s*−5,250\.00\s*↘ สวนรับคืนหนี้\s*\+8,500\.00/);
    expect(debt).not.toHaveTextContent(/\+3,250\.00/);
    expect(text('co-src-rounding')).toHaveTextContent(/แดง\s*\+0\.50\s*สวน\s*−0\.50/);
    expect(text('co-src-transfer-split')).toHaveTextContent('= ส่วนสวน 14,437.50 − ปัด 0.50 + ↘ คืนหนี้ 8,500.00');
    expect(text('co-src-transfer-repay').props.style).toEqual(expect.anything());
  });

  it('② with netting as A25: the ↗ pairs in orange and the farm row "รวมหักกลบ"', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press(`co-deduct-${farm.nat}`);
    await press('co-net-link');
    await press('co-deduct-ok');
    await press('co-sources-open');
    const debt = text('co-src-debt');
    expect(debt).toHaveTextContent(/หนี้ลด 9,140 = รับคืน 8,500 \+ หักกลบ 640/);
    expect(debt).toHaveTextContent(/นัด ↘ จ่ายหนี้\s*−5,890\.00/);
    expect(debt).toHaveTextContent(/นัด ↗ ได้คืนจากสวน \(หักกลบ\)\s*\+640\.00/);
    expect(debt).toHaveTextContent(/สวน ↘ รับคืนหนี้ \(รวมหักกลบ\)\s*\+9,140\.00/);
    expect(debt).toHaveTextContent(/สวน ↗ คืนนัด \(หักกลบ\)\s*−640\.00/);
  });

  it('the sale strip opens รายละเอียดการขาย with today\'s figures', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press('co-sale-open');
    const s = text('co-sale-sheet');
    expect(s).toHaveTextContent(/รายละเอียดการขาย/);
    expect(s).toHaveTextContent(/550 กก\./);
    expect(s).toHaveTextContent(/ส่วนแบ่งแดง 50%.*9,187\.50/);
    expect(s).toHaveTextContent(/รวม = ขายวันนี้.*28,875\.00/);
    // review #13: no leftover "ก ·" from the old page's section letters
    expect(text('co-sale-split')).toHaveTextContent(/^แบ่งยอดขาย$/);
  });

  it('the debt sheet footer says oldest first without "ปิด" (review #13)', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press('co-debt-open');
    expect(text('co-debt-oldest')).toHaveTextContent(/^หักก้อนเก่าที่สุดก่อน$/);
  });
});

describe('ยืนยันยอด (CO-3): one write, then the payment page', () => {
  it('nothing is written until confirm; then the deductions are recorded and the page moves on', async () => {
    await inSale(<CloseoutSummaryScreen />);
    await press('co-debt-open');
    await press('co-debt-ok');
    await press('co-owed-open');
    await press('co-owed-ok');
    // the cash step is not a gate (A3, owner 2026-10-31): both cards checked → confirm is on without opening it
    expect(disabled('co-confirm')).toBe(false);
    expect(text('co-confirm')).toHaveTextContent('ยืนยันยอด · ไปจ่ายเงิน');
    expect(await count('debt_payment_recorded')).toBe(0);
    await press('co-confirm');
    expect(await count('debt_payment_recorded')).toBe(2);
    expect(await count('repayment_recorded')).toBe(0);
    expect(router().push).toHaveBeenCalledWith(`/v2/sale/${SALE}/payment`);
  });
});
