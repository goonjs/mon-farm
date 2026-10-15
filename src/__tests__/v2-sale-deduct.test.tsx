import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { LogBuilder } from '../core/fixtures';
import { projectFinance } from '../core/finance/ledger';
import { FARM_FUNDS } from '../core/finance/types';
import { financeStore } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import type { MasterStore } from '../store/master-store';
import { SaleProvider } from '../store/SaleProvider';
import type { EventStore } from '../store/store';
import { seedMockFarm, seedSale, type MockFarm } from '../test/sale-fixture';
import { wrap } from '../test/render';
import { PaymentScreen, SettlementScreen, TallyScreen } from '../v2/sale/money-screens';

/**
 * The deduct sheet and the settlement card as on sale mockup v1.1.0 pages
 * 17 and 17a (E06-S04, owner 2026-10-14): หักหนี้ is the whole debt taken at
 * this sale, netting is a + line, the route collects the difference; the
 * sheet shows where the debt comes from and why that amount is proposed;
 * − / + steppers; each route says what it moves; a saved deduction is edited,
 * not added to.
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
const type = async (id: string, text: string) => {
  await act(async () => fireEvent.changeText(screen.getByTestId(id), text));
  await flush();
};
const value = (id: string) => screen.getByTestId(id).props.value as string;
const SALE = 'sale-ded';
const inSale = async (ui: ReactElement, saleId = SALE) => {
  const r = wrap(<SaleProvider saleId={saleId}>{ui}</SaleProvider>);
  await flush();
  return r;
};
const FARM = { id: FARM_FUNDS, name: 'เงินสวน' };
const live = async (worker: string) => {
  const all = await financeStore.load();
  const deleted = new Set(all.filter((e) => e.payload.t === 'debt_payment_changed' && e.payload.patch.deleted).map((e) => e.targetId));
  return all.flatMap((e) => (e.payload.t === 'debt_payment_recorded' && e.payload.fields.worker.id === worker && !deleted.has(e.targetId) ? [e.payload.fields] : []));
};

let farm: MockFarm;

const saleOf = (id: string) => {
  const b = new LogBuilder(id);
  b.sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' });
  b.sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' });
  for (const p of [farm.a[0], farm.a[3]]) b.sys({ t: 'pile_added', pileId: p, zoneId: farm.farmA, name: p, tareG: 2_000, stdNetG: 50_000 });
  b.acceptAt(farm.a[0], 1).acceptAt(farm.a[0], 2).acceptAt(farm.a[0], 3);
  b.acceptAt(farm.a[3], 1).shortAt(farm.a[3], 2, 37_000);
  return b.build().map((e) => ({ ...e, ts: Date.now() }));
};

/**
 * แดง's share is ฿3,637.50 and นัด's ฿2,061.25. แดง owes the farm ฿5,000 on a
 * ฿2,000-a-sale plan. นัด owes ฿1,500 for fertilizer, and the farm owes นัด ฿640.
 */
beforeAll(async () => {
  farm = await seedMockFarm(master());
  await seedSale(store(), saleOf(SALE));
  const RED = { id: farm.red, name: 'แดง' };
  const NAT = { id: farm.nat, name: 'นัด' };
  await writeFinance('debt-red', null, { t: 'debt_added', fields: { worker: RED, kind: 'loan', amountSatang: 500_000, date: '2026-09-01', note: '', lender: FARM, fertilizer: null, carriedForward: false } });
  await writeFinance('plan-red', null, { t: 'debt_plan_set', worker: RED, perSaleSatang: 200_000 });
  await writeFinance('debt-nat', null, { t: 'debt_added', fields: { worker: NAT, kind: 'fertilizer', amountSatang: 150_000, date: '2026-09-01', note: '', lender: null, fertilizer: { totalSatang: 300_000, workerPct: 50 }, carriedForward: false } });
  await writeFinance('exp-nat', null, { t: 'expense_created', fields: { amountSatang: 64_000, date: '2026-09-12', stage: 'actual', categoryId: null, propertyId: null, item: 'ค่าน้ำมันตัดหญ้า', note: '', payer: NAT } });
});

describe('page 17 before anything is deducted', () => {
  it('a worker who owes shows the debt and, beside it, what the farm owes them back', async () => {
    await inSale(<SettlementScreen />);
    expect(screen.getByTestId(`owed-hint-${farm.nat}`)).toHaveTextContent(/นัดติดสวน.*1,500\.00/);
    expect(screen.getByTestId(`owed-hint-${farm.nat}`)).toHaveTextContent(/สวนติดนัด\s*640\.00/);
    expect(screen.getByTestId(`owed-hint-${farm.red}`)).not.toHaveTextContent(/สวนติด/);
  });

  it('says today\'s sale first: kg × price = total (owner 2026-10-14, mockup v1.2.0)', async () => {
    await inSale(<SettlementScreen />);
    expect(screen.getByTestId('sale-today')).toHaveTextContent(/235 กก\. × 48\.50 ฿\/กก\./);
    expect(screen.getByTestId('sale-today')).toHaveTextContent(/11,397\.50/);
    // the sale block holds no debt; debt has its own block, "not the sale"
    expect(screen.getByTestId('sale-split')).not.toHaveTextContent(/หนี้/);
    expect(screen.getByTestId('debt-block')).toHaveTextContent(/ไม่ใช่ยอดขาย/);
  });
});

describe('page 17a — the deduct sheet', () => {
  it('shows where the debt comes from and why that amount is proposed, already filled in', async () => {
    await inSale(<SettlementScreen />);
    await press(`deduct-${farm.nat}`);
    expect(screen.getByTestId('deduct-breakdown')).toHaveTextContent(/ค่าปุ๋ย/);
    expect(screen.getByTestId('deduct-reason')).toHaveTextContent('ไม่มีแผนผ่อน → เสนอยอดค้างทั้งหมด');
    expect(value('deduct-amount')).toBe('1,500.00');
    await press('deduct-cancel');
    await press(`deduct-${farm.red}`);
    expect(screen.getByTestId('deduct-reason')).toHaveTextContent('มีแผนผ่อน งวดละ 2,000.00 → เสนองวดผ่อน');
    expect(value('deduct-amount')).toBe('2,000.00');
  });

  it('− / + step by ฿100 and stop at 0 and at the ceiling', async () => {
    await inSale(<SettlementScreen />);
    await press(`deduct-${farm.nat}`);
    await press('deduct-amount-minus');
    expect(value('deduct-amount')).toBe('1,400.00');
    await press('deduct-amount-plus');
    await press('deduct-amount-plus');
    expect(value('deduct-amount')).toBe('1,500.00');
    await press('net-amount-plus');
    expect(value('net-amount')).toBe('100.00');
    await press('net-amount-minus');
    await press('net-amount-minus');
    expect(value('net-amount')).toBe('0.00');
  });

  it('netting is a + line; the route collects only the difference and says what it moves', async () => {
    await inSale(<SettlementScreen />);
    await press(`deduct-${farm.nat}`);
    await type('net-amount', '640');
    expect(screen.getByTestId('sheet-deducted')).toHaveTextContent(/หนี้นัดลดรวม\s*1,500\.00/);
    // นัด repays 1,500 (↘); the farm repays นัด 640 (↗, by netting); only 860 is money
    expect(screen.getByTestId('sheet-repay')).toHaveTextContent(/นัด → สวน จ่ายหนี้.*1,500\.00/);
    expect(screen.getByTestId('sheet-back')).toHaveTextContent(/สวน → นัด คืนเงิน.*640\.00/);
    expect(screen.getByTestId('sheet-netted')).toHaveTextContent(/640\.00/);
    expect(screen.getByTestId('sheet-netted')).not.toHaveTextContent(/[+−]/);
    expect(screen.getByTestId('route-amount')).toHaveTextContent(/นัดต้องจ่ายหนี้เป็นเงินจริง\s*860\.00/);
    expect(screen.getByTestId('method-cash-from-share')).toHaveTextContent(/เงินสดเข้ามือ 860\.00/);
    expect(screen.getByTestId('method-transfer-with-owner')).toHaveTextContent(/เข้าบัญชี 860\.00/);
    expect(screen.getByTestId('method-buyer-split')).toHaveTextContent(/เงินของนัด 1,201\.25/);
    // the pile 1,000 + 1,000 + 50 + 10 + 1 + 0.25 cannot give 860 as it is
    expect(screen.getByTestId('needs-change')).toHaveTextContent('ต้องแตกเงิน');
    await press('why-notes');
    expect(screen.getByTestId('pile-notes')).toHaveTextContent(/1,000/);
    expect(screen.getByTestId('sheet-pay')).toHaveTextContent(/1,201\.25/);
    expect(screen.getByTestId('sheet-debt-left')).toHaveTextContent(/0\.00/);
  });

  it('the debt deducted cannot be less than the netting, nor above the ceiling', async () => {
    await inSale(<SettlementScreen />);
    await press(`deduct-${farm.nat}`);
    await type('net-amount', '640');
    await type('deduct-amount', '500');
    expect(screen.getByTestId('deduct-save')).toBeDisabled();
    expect(screen.getByTestId('deduct-amount-error')).toHaveTextContent('หักหนี้ต้องไม่น้อยกว่ายอดหักกลบ 640.00');
    await type('deduct-amount', '1500.01');
    expect(screen.getByTestId('deduct-save')).toBeDisabled();
    expect(screen.getByTestId('deduct-amount-error')).toHaveTextContent('หักได้ไม่เกิน 1,500.00');
    // − stops at the netting, not at 0 (review 2 #5)
    await type('deduct-amount', '700');
    await press('deduct-amount-minus');
    expect(value('deduct-amount')).toBe('640.00');
    await press('deduct-amount-minus');
    expect(value('deduct-amount')).toBe('640.00');
    // an empty box is 0, not the proposal (review F8): with nothing saved yet there is nothing to write
    await type('net-amount', '');
    await type('deduct-amount', '');
    expect(screen.getByTestId('deduct-save')).toBeDisabled();
  });

  it('saving writes the netting and the difference by the chosen route; the card shows −1,500 and +640', async () => {
    await inSale(<SettlementScreen />);
    await press(`deduct-${farm.nat}`);
    await type('net-amount', '640');
    await press('method-transfer-with-owner');
    expect(screen.getByTestId('net-applied')).toHaveTextContent('ใช้หักกลบ 640.00 แล้ว');
    await press('deduct-save');
    const pays = await live(farm.nat);
    expect(pays.map((p) => [p.method, p.amountSatang]).sort()).toEqual([['netting', 64_000], ['transfer-with-owner', 86_000]]);
    // ข, two separate chunks (owner 2026-10-14): tappers pay the farm (↘) — นัด 1,500; the farm repays tappers (↗) — นัด 640, by netting
    expect(screen.getByTestId('debt-in-chunk')).toHaveTextContent(/คนกรีดยางจ่ายหนี้สวน/);
    expect(screen.getByTestId(`deducted-${farm.nat}`)).toHaveTextContent(/นัดจ่ายหนี้สวน.*1,500\.00/);
    expect(screen.getByTestId('debt-out-chunk')).toHaveTextContent(/สวนคืนเงินคนกรีดยาง/);
    expect(screen.getByTestId(`netted-${farm.nat}`)).toHaveTextContent(/สวนคืนเงินนัด.*หักกลบ.*640\.00/);
    expect(screen.getByTestId(`netted-${farm.nat}`)).not.toHaveTextContent(/[+−]/);
    // ค: นัด's money = share − 1,500 repaid + 640 the farm repaid
    expect(screen.getByTestId(`pay-route-${farm.nat}`)).toHaveTextContent(/นัด → สวน จ่ายหนี้.*1,500\.00/);
    expect(screen.getByTestId(`pay-back-${farm.nat}`)).toHaveTextContent(/สวน → นัด คืนเงิน.*640\.00/);
    expect(screen.getByTestId(`cash-${farm.nat}`)).toHaveTextContent(/1,201/);
    expect(screen.getByTestId('owner-transfer-in')).toHaveTextContent(/เงินจากนัด.*860\.00/);
    // one deduction per worker per sale: it is edited from here, not added to
    expect(screen.queryByTestId(`deduct-${farm.nat}`)).toBeNull();
    expect(screen.getByTestId(`edit-deduct-${farm.nat}`)).toHaveTextContent('แก้ยอดหัก / วิธีรับเงิน');
  });

  it('a plan labels the line งวดผ่อน, and the card says which notes to lift out', async () => {
    await inSale(<SettlementScreen />);
    await press(`deduct-${farm.red}`);
    await press('deduct-save');
    expect(screen.getByTestId(`deducted-${farm.red}`)).toHaveTextContent(/แดงจ่ายหนี้สวน · งวดผ่อน/);
    expect(screen.getByTestId(`deducted-${farm.red}`)).toHaveTextContent(/2,000\.00/);
    expect(screen.getByTestId('cash-today')).toHaveTextContent(/แดง.*2,000\.00/);
    expect(screen.getByTestId(`notes-${farm.red}`)).toHaveTextContent('หยิบแบงค์พัน 2 ใบ — ไม่ต้องแตก');
    expect(screen.getByTestId(`debt-left-${farm.red}`)).toHaveTextContent(/3,000\.00/);
  });

  it('editing reopens what was saved — not a second instalment (review F7) — and replaces it', async () => {
    await inSale(<SettlementScreen />);
    await press(`edit-deduct-${farm.red}`);
    expect(value('deduct-amount')).toBe('2,000.00');
    await type('deduct-amount', '1500');
    await press('deduct-save');
    expect((await live(farm.red)).map((p) => p.amountSatang)).toEqual([150_000]);
    expect(screen.getByTestId(`debt-left-${farm.red}`)).toHaveTextContent(/3,500\.00/);
  });

  it('saving an edit that changes nothing writes nothing (review 2 #2)', async () => {
    await inSale(<SettlementScreen />);
    const before = (await financeStore.load()).length;
    await press(`edit-deduct-${farm.red}`);
    await press('deduct-save');
    expect((await financeStore.load()).length).toBe(before);
    expect(screen.queryByTestId('deduct-sheet')).toBeNull();
  });

  it('editing keeps the netting and changes the route: the owed money is placed again, not lost (review 2 #4)', async () => {
    await inSale(<SettlementScreen />);
    await press(`edit-deduct-${farm.nat}`);
    expect(value('net-amount')).toBe('640.00');
    // the 640 the old netting took is back on offer while editing
    expect(screen.getByTestId('net-card')).toHaveTextContent(/สวนติดนัด 640\.00/);
    await press('method-cash-from-share');
    await press('deduct-save');
    expect((await live(farm.nat)).map((p) => [p.method, p.amountSatang]).sort()).toEqual([['cash-from-share', 86_000], ['netting', 64_000]]);
    const all = await financeStore.load();
    const gone = new Set(all.filter((e) => e.payload.t === 'repayment_changed' && e.payload.patch.deleted).map((e) => e.targetId));
    expect(all.filter((e) => e.payload.t === 'repayment_recorded' && !gone.has(e.targetId))).toHaveLength(1);
    const owed = projectFinance(all).reimbursements.find((r) => r.to.id === farm.nat)!;
    expect(owed.remainingSatang).toBe(0);
    expect(screen.getByTestId(`deducted-${farm.nat}`)).toHaveTextContent(/นัดจ่ายหนี้สวน.*1,500\.00/);
    expect(screen.getByTestId(`netted-${farm.nat}`)).toHaveTextContent(/640\.00/);
  });

  it('editing a netted deduction to 0 removes both lines and the repayment', async () => {
    await inSale(<SettlementScreen />);
    await press(`edit-deduct-${farm.nat}`);
    expect(value('deduct-amount')).toBe('1,500.00');
    expect(value('net-amount')).toBe('640.00');
    await type('net-amount', '0');
    await type('deduct-amount', '0');
    await press('deduct-save');
    expect(await live(farm.nat)).toEqual([]);
    const all = await financeStore.load();
    const gone = new Set(all.filter((e) => e.payload.t === 'repayment_changed' && e.payload.patch.deleted).map((e) => e.targetId));
    expect(all.filter((e) => e.payload.t === 'repayment_recorded' && !gone.has(e.targetId))).toHaveLength(0);
    expect(screen.queryByTestId(`netted-${farm.nat}`)).toBeNull();
    expect(screen.getByTestId(`deduct-${farm.nat}`)).toBeTruthy();
  });
});

describe('netting is pressed by the owner, never by itself (D-60): a warning before saving without it', () => {
  const WARN = 'sale-warn';
  beforeAll(async () => {
    await seedSale(store(), saleOf(WARN));
  });
  it('the first save without netting warns; the second saves as asked', async () => {
    await inSale(<SettlementScreen />, WARN);
    await press(`deduct-${farm.nat}`);
    const before = (await financeStore.load()).length;
    await press('deduct-save');
    expect(screen.getByTestId('deduct-net-warning')).toHaveTextContent(/สวนยังติดนัด 640\.00/);
    expect((await financeStore.load()).length).toBe(before);
    await press('deduct-save');
    expect(screen.queryByTestId('deduct-sheet')).toBeNull();
    expect((await financeStore.load()).length).toBe(before + 1);
  });

  it('editing a saved deduction does not warn again (review 3 #6)', async () => {
    await inSale(<SettlementScreen />, WARN);
    await press(`edit-deduct-${farm.nat}`);
    await type('deduct-amount', '1400');
    await press('deduct-save');
    expect(screen.queryByTestId('deduct-net-warning')).toBeNull();
    expect(screen.queryByTestId('deduct-sheet')).toBeNull();
  });

  it('before rounding is answered, the owner card shows the transfer unrounded (review 3 #2)', async () => {
    await inSale(<SettlementScreen />, WARN);
    // นัด pays from his cash here, so the transfer is the farm part as it stands before rounding
    expect(screen.getByTestId('owner-transfer')).toHaveTextContent(/5,698\.75/);
  });
});

describe('an older sale (review 2 #1, #3)', () => {
  const OLD = 'sale-old';
  const day = '2026-10-03';
  beforeAll(async () => {
    await seedSale(store(), saleOf(OLD).map((e) => ({ ...e, ts: Date.parse(`${day}T08:00:00`) })));
    // Two routes left by the old "add another deduction" button.
    for (const [id, method] of [['old-1', 'cash-from-share'], ['old-2', 'transfer-with-owner']] as const) {
      await writeFinance(id, null, { t: 'debt_payment_recorded', fields: { worker: { id: farm.red, name: 'แดง' }, creditor: FARM, amountSatang: 10_000, date: day, note: '', method, saleId: OLD } });
    }
  });

  it('warns before two routes become one', async () => {
    await inSale(<SettlementScreen />, OLD);
    await press(`edit-deduct-${farm.red}`);
    expect(screen.getByTestId('deduct-merge-warning')).toBeTruthy();
  });

  it('dates what it writes by the sale, not by today', async () => {
    await inSale(<SettlementScreen />, OLD);
    await press(`edit-deduct-${farm.red}`);
    await type('deduct-amount', '300');
    await press('deduct-save');
    const mine = (await financeStore.load()).flatMap((e) => (e.payload.t === 'debt_payment_recorded' && e.payload.fields.saleId === OLD ? [e.payload.fields] : []));
    expect(mine.filter((p) => p.amountSatang === 30_000).map((p) => p.date)).toEqual([day]);
  });
});

describe('D-61: deducted over the share', () => {
  const OVER = 'sale-over';
  beforeAll(async () => {
    await seedSale(store(), saleOf(OVER));
    // As if the sale was edited down after the deduction: ฿4,000 taken from a ฿3,637.50 share.
    await writeFinance('pay-over', null, {
      t: 'debt_payment_recorded',
      fields: { worker: { id: farm.red, name: 'แดง' }, creditor: FARM, amountSatang: 400_000, date: '2026-10-14', note: '', method: 'cash-from-share', saleId: OVER },
    });
  });

  it('the tally checks are real: over-deducted, the debt check and the tapper line show ✗ (review 3 #1)', async () => {
    await inSale(<TallyScreen />, OVER);
    expect(screen.getByTestId('tally-off')).toBeTruthy();
    expect(screen.getByTestId('tally-check-debt')).toHaveTextContent(/✗/);
    expect(screen.getByTestId(`tally-mismatch-${farm.red}`)).toBeTruthy();
  });

    it('locks the owner\'s transfer tick too (review F6)', async () => {
    await inSale(<PaymentScreen />, OVER);
    expect(screen.getAllByTestId('tick-owner').pop()!.props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getAllByTestId(`tick-${farm.red}`).pop()!.props.accessibilityState).toMatchObject({ disabled: true });
  });
});
