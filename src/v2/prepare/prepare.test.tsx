import { act, fireEvent, screen } from '@testing-library/react-native';

import type { FinanceEvent, FinancePayload, Payer, SalePrepPatch } from '../../core/finance/types';
import { FARM_FUNDS } from '../../core/finance/types';
import { SALE_PREP_TARGET } from '../../core/finance/sale-prep';
import { expectChoiceTile } from '../../test/choice-shape';
import { wrap } from '../../test/render';
import { PrepBuyerView, PrepView } from './prepare-screen';

/**
 * E15-S01 · เตรียมการขาย (owner 2026-11-17 "ก · ก · โอเค ทำตามนี้", mockup docs/ux/mockups/e15-s01-sale-prep.html).
 * One page, 4 rows the whole of which is the tap target, each ☐/✓. A help, never a gate.
 */

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() }, useLocalSearchParams: () => ({}) }));

let n = 0;
function ev(targetId: string, payload: FinancePayload, ts?: number): FinanceEvent {
  n += 1;
  return { id: `e${String(n).padStart(4, '0')}`, groupId: 'g', deviceSeq: n, ts: ts ?? n, actor: { userId: 'u', deviceId: 'd' }, source: 'app', targetId, baseEventId: null, payload };
}
const prep = (patch: SalePrepPatch, ts?: number) => ev(SALE_PREP_TARGET, { t: 'sale_prep_set', patch }, ts);
const DAENG: Payer = { id: 'p-daeng', name: 'แดง' };
const NAT: Payer = { id: 'p-nat', name: 'นัด' };
const item = (id: string, sacks: number, perSack: number) =>
  ev(id, {
    t: 'expense_created',
    fields: {
      amountSatang: sacks * perSack * 100, date: '2026-11-01', stage: 'actual', categoryId: 'cat-fertilizer', propertyId: null, item: 'ดีเกลือ', note: '', payer: { id: FARM_FUNDS, name: '' }, orderId: `o-${id}`,
      line: { qty: sacks, unit: 'กระสอบ', grossSatang: sacks * perSack * 100, itemDiscountSatang: 0 },
      fertilizer: { type: 'chemical', formula: 'ดีเกลือ', brand: '', sackKg: 50, reasons: [], zones: [], shop: 'ร้าน ก.', orderedBy: '', sacks },
    },
  });
const fertilizing = (id: string, date: string, takes: { worker: Payer; sacks: number }[], sacks: number) =>
  ev(id, { t: 'fertilizing_recorded', fields: { date, lines: [{ sources: ['a'], sacks, takes: takes.map((x) => ({ ...x, auto: false })), rest: null }], pct: {}, settle: {}, zones: [], reasons: [], note: '' } });

const BUYERS = [
  { id: 'b1', name: 'คนรับซื้อยาง ก' },
  { id: 'b2', name: 'สหกรณ์บ้านนา' },
];

function setup(events: FinanceEvent[], o: { lastSaleDay?: string | null; lastSaleTs?: number | null } = {}) {
  const onWrite = jest.fn(async (_p: SalePrepPatch) => undefined);
  const onBuyer = jest.fn();
  const onFert = jest.fn();
  wrap(<PrepView events={events} lastSaleDay={o.lastSaleDay ?? null} lastSaleTs={o.lastSaleTs ?? null} onWrite={onWrite} onBuyer={onBuyer} onFert={onFert} onBack={jest.fn()} />);
  return { onWrite, onBuyer, onFert };
}
const press = async (id: string) => {
  await act(async () => fireEvent.press(screen.getByTestId(id)));
};
const checked = (id: string) => screen.getByTestId(id).props.accessibilityState?.checked;

describe('PrepView — เตรียมการขาย (E15-S01)', () => {
  it('nothing prepared: buyer, date and price open; fertilizer done when nothing is left to split (PREP-2, PREP-6)', () => {
    setup([]);
    expect(checked('prep-buyer')).toBe(false);
    expect(checked('prep-date')).toBe(false);
    expect(checked('prep-price')).toBe(false);
    expect(checked('prep-fert')).toBe(true);
    expect(screen.getByTestId('prep-fert')).toHaveTextContent(/แบ่งครบแล้ว/);
    expect(screen.queryByTestId('prep-ready')).toBeNull();
    expect(screen.queryByTestId('prep-cancel')).toBeNull();
  });

  it('the buyer row opens the full-page buyer list (PREP-3)', async () => {
    const { onBuyer } = setup([]);
    await press('prep-buyer');
    expect(onBuyer).toHaveBeenCalled();
  });

  it('the date row: the in-app calendar, then an optional time (PREP-4)', async () => {
    const { onWrite } = setup([]);
    await press('prep-date');
    await press('prep-date-picker-day-2026-11-21');
    await press('prep-date-picker-done');
    // The day is written when picked, so closing the time sheet keeps it (review N1).
    expect(onWrite).toHaveBeenLastCalledWith({ date: '2026-11-21' });
    await press('prep-time-08:00');
    expect(onWrite).toHaveBeenLastCalledWith({ time: '08:00' });
  });

  it('the date row opens the app\'s own DatePickerSheet: quick picks วันนี้ / พรุ่งนี้ / มะรืน, no past picks, the calendar free (owner 2026-11-17, PREP-10)', async () => {
    const onWrite = jest.fn(async (_p: SalePrepPatch) => undefined);
    wrap(<PrepView events={[]} today="2026-11-17" lastSaleDay={null} lastSaleTs={null} onWrite={onWrite} onBuyer={jest.fn()} onFert={jest.fn()} onBack={jest.fn()} />);
    await press('prep-date');
    expect(screen.getByTestId('prep-date-picker')).toBeTruthy();
    expect(screen.getByTestId('prep-date-picker-today')).toBeTruthy();
    expect(screen.getByTestId('prep-date-picker-tomorrow')).toBeTruthy();
    expect(screen.getByTestId('prep-date-picker-dayafter')).toBeTruthy();
    expect(screen.queryByTestId('prep-date-picker-yesterday')).toBeNull();
    expect(screen.queryByTestId('prep-date-picker-twodays')).toBeNull();
    await press('prep-date-picker-day-2026-11-10');
    await press('prep-date-picker-done');
    expect(onWrite).toHaveBeenLastCalledWith({ date: '2026-11-10' });
  });

  it('เสร็จ goes back; every choice was already written, so nothing else is saved here (owner 2026-11-17, PREP-13)', async () => {
    const onWrite = jest.fn(async (_p: SalePrepPatch) => undefined);
    const onBack = jest.fn();
    wrap(<PrepView events={[]} lastSaleDay={null} lastSaleTs={null} onWrite={onWrite} onBuyer={jest.fn()} onFert={jest.fn()} onBack={onBack} />);
    await press('prep-done');
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onWrite).not.toHaveBeenCalled();
  });

  it('"today" on the calendar is the farm\'s day (Bangkok), not the device\'s', async () => {
    const onWrite = jest.fn(async (_p: SalePrepPatch) => undefined);
    wrap(<PrepView events={[]} today="2026-11-30" lastSaleDay={null} lastSaleTs={null} onWrite={onWrite} onBuyer={jest.fn()} onFert={jest.fn()} onBack={jest.fn()} />);
    await press('prep-date');
    await press('prep-date-picker-today');
    await press('prep-date-picker-done');
    expect(onWrite).toHaveBeenLastCalledWith({ date: '2026-11-30' });
  });

  // E01-S26 PS26-6 · owner prep-time-default 2026-11-22 23:37: "ข · ข · ต้องแตะเลือกเวลาก่อนเสมอ ปิดแผ่นเฉยๆ = ไม่บันทึก".
  // Replaces "the time can be left out": "ไม่ระบุเวลา" is gone (owner 2026-11-20 "เปลี่ยนปุ่ม ไม่ระบุเวลา เป็นกำหนดเอง").
  const openTime = async () => {
    await press('prep-date');
    await press('prep-date-picker-day-2026-11-21');
    await press('prep-date-picker-done');
  };

  it('the time sheet: 08:00–13:00 hourly as F tiles plus "กำหนดเอง", no "ไม่ระบุเวลา"; a tap writes that time (PS26-6)', async () => {
    const { onWrite } = setup([]);
    await openTime();
    for (const h of ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00']) {
      expectChoiceTile(screen.getByTestId(`prep-time-${h}`), 'check');
      // Nothing is ticked before a tap: the owner wants a time always tapped.
      expect(screen.getByTestId(`prep-time-${h}`).props.accessibilityState).toMatchObject({ selected: false });
    }
    expect(screen.queryByTestId('prep-time-06:00')).toBeNull();
    expect(screen.queryByTestId('prep-time-07:00')).toBeNull();
    expect(screen.queryByTestId('prep-time-none')).toBeNull();
    expect(screen.queryByText('ไม่ระบุเวลา')).toBeNull();
    expectChoiceTile(screen.getByTestId('prep-time-custom'), 'add');
    await press('prep-time-11:00');
    expect(onWrite).toHaveBeenLastCalledWith({ time: '11:00' });
    expect(screen.queryByTestId('prep-time-11:00')).toBeNull();
  });

  it('closing the time sheet without a tap writes no time (owner ข); the day picked stays', async () => {
    const { onWrite } = setup([]);
    await openTime();
    await press('prep-time-scrim');
    expect(onWrite).toHaveBeenCalledTimes(1);
    expect(onWrite).toHaveBeenLastCalledWith({ date: '2026-11-21' });
  });

  it('the set time is the ticked tile when the sheet opens again', async () => {
    setup([prep({ date: '2026-11-21', time: '12:00' })]);
    await press('prep-date');
    await press('prep-date-picker-done');
    expect(screen.getByTestId('prep-time-12:00').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('prep-time-10:00').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('"กำหนดเอง" opens hour and minute wheels: minutes only 00 · 15 · 30 · 45, starting at 10:00; ตกลง writes (owner 2026-11-21)', async () => {
    const { onWrite } = setup([]);
    await openTime();
    await press('prep-time-custom');
    expect(screen.getByTestId('prep-time-wheel')).toBeTruthy();
    expect(screen.getByTestId('prep-time-wheel-h-10').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('prep-time-wheel-m-00').props.accessibilityState).toMatchObject({ selected: true });
    for (const m of ['00', '15', '30', '45']) expect(screen.getByTestId(`prep-time-wheel-m-${m}`)).toBeTruthy();
    for (const m of ['05', '10', '20', '50']) expect(screen.queryByTestId(`prep-time-wheel-m-${m}`)).toBeNull();
    expect(screen.getByTestId('prep-time-wheel-done')).toHaveTextContent(/10:00/);
    await press('prep-time-wheel-h-14');
    await press('prep-time-wheel-m-45');
    expect(screen.getByTestId('prep-time-wheel-done')).toHaveTextContent(/14:45/);
    await press('prep-time-wheel-done');
    expect(onWrite).toHaveBeenLastCalledWith({ time: '14:45' });
  });

  it('closing the wheel without ตกลง writes no time', async () => {
    const { onWrite } = setup([]);
    await openTime();
    await press('prep-time-custom');
    await press('prep-time-wheel-h-09');
    await press('prep-time-wheel-scrim');
    expect(onWrite).toHaveBeenCalledTimes(1);
    expect(onWrite).toHaveBeenLastCalledWith({ date: '2026-11-21' });
  });

  it('a prep saved before with no time still shows the day alone (old data unchanged)', () => {
    setup([prep({ date: '2026-11-21', time: null })]);
    expect(checked('prep-date')).toBe(true);
    expect(screen.getByTestId('prep-date')).not.toHaveTextContent(/:/);
  });

  it('the price row takes the agreed ฿/กก. on the app pad (PREP-5)', async () => {
    const { onWrite } = setup([]);
    await press('prep-price');
    for (const k of '52.50') await press(`prep-price-input-pad-key-${k}`);
    await press('prep-price-input-done');
    expect(onWrite).toHaveBeenLastCalledWith({ priceSatangPerKg: 5250 });
  });

  it('fertilizer not split yet: the row says how many and opens the list to split (PREP-6)', async () => {
    const { onFert } = setup([item('a', 10, 300), fertilizing('fz-1', '2026-11-10', [], 4)]);
    expect(checked('prep-fert')).toBe(false);
    expect(screen.getByTestId('prep-fert')).toHaveTextContent(/ใส่ปุ๋ยยังไม่แบ่ง 1 ครั้ง/);
    await press('prep-fert');
    expect(onFert).toHaveBeenCalled();
  });

  it('all four done: ✓ พร้อมขาย, the set values, and the new fertilizer debt per tapper with Σ (PREP-1, PREP-7)', () => {
    setup([
      item('a', 10, 300),
      fertilizing('fz-1', '2026-11-12', [{ worker: DAENG, sacks: 4 }, { worker: NAT, sacks: 2 }], 6),
      prep({ buyerId: 'b1', buyerName: 'คนรับซื้อยาง ก', date: '2026-11-21', time: '08:00', priceSatangPerKg: 5250 }),
    ], { lastSaleDay: '2026-11-05' });
    expect(screen.getByTestId('prep-ready')).toHaveTextContent(/พร้อมขาย/);
    expect(screen.getByTestId('prep-buyer')).toHaveTextContent(/คนรับซื้อยาง ก/);
    expect(screen.getByTestId('prep-date')).toHaveTextContent(/21 พ\.ย\./);
    expect(screen.getByTestId('prep-date')).toHaveTextContent(/08:00/);
    expect(screen.getByTestId('prep-price')).toHaveTextContent(/52\.50/);
    // 4 × 300 = 1,200 → 50% = 600 for แดง; 2 × 300 = 600 → 300 for นัด.
    expect(screen.getByTestId('prep-fert-debts')).toHaveTextContent(/แดง.*600.*นัด.*300/);
    expect(screen.getByTestId('prep-fert-total')).toHaveTextContent(/Σ.*900/);
  });

  it('one tapper with new fertilizer debt: their line only, no Σ (summary-lines, review N2)', () => {
    setup([item('a', 10, 300), fertilizing('fz-1', '2026-11-12', [{ worker: DAENG, sacks: 4 }], 4)], { lastSaleDay: '2026-11-05' });
    expect(screen.getByTestId('prep-fert-debts')).toHaveTextContent(/แดง.*600/);
    expect(screen.queryByTestId('prep-fert-total')).toBeNull();
  });

  it('cancelling the prep writes cancelled; it can be prepared again (PREP-8)', async () => {
    const { onWrite } = setup([prep({ buyerId: 'b1', buyerName: 'คนรับซื้อยาง ก' })]);
    await press('prep-cancel');
    expect(onWrite).toHaveBeenLastCalledWith({ cancelled: true });
  });

  it('a sale started after the last prep write has used it: the page starts empty again (PREP-8)', () => {
    setup([prep({ buyerId: 'b1', buyerName: 'คนรับซื้อยาง ก' }, 100)], { lastSaleTs: 200 });
    expect(checked('prep-buyer')).toBe(false);
  });
});

describe('PrepBuyerView — นัดคนรับซื้อ, a full page (PREP-3, PREP-11)', () => {
  it('lists the buyers, the latest first; a tap picks one', async () => {
    const onPick = jest.fn();
    const onAdd = jest.fn();
    wrap(<PrepBuyerView buyers={BUYERS} latestId="b2" onPick={onPick} onAdd={onAdd} onBack={jest.fn()} />);
    expect(screen.getAllByTestId(/^prep-buyer-b/).map((x) => x.props.testID)).toEqual(['prep-buyer-b2', 'prep-buyer-b1']);
    await press('prep-buyer-b1');
    expect(onPick).toHaveBeenCalledWith({ id: 'b1', name: 'คนรับซื้อยาง ก' });
    await press('prep-buyer-add');
    expect(onAdd).toHaveBeenCalled();
  });

  it('a row is a tick to choose from, not a › to go on; the chosen buyer is ticked (owner 2026-11-17, PREP-11)', () => {
    wrap(<PrepBuyerView buyers={BUYERS} latestId="b2" selectedId="b1" onPick={jest.fn()} onAdd={jest.fn()} onBack={jest.fn()} />);
    expect(screen.getByTestId('prep-buyer-b1').props.accessibilityRole).toBe('checkbox');
    expect(screen.getByTestId('prep-buyer-b1').props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId('prep-buyer-b2').props.accessibilityState.checked).toBe(false);
  });
});
