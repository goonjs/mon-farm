import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import type { ExpenseFields, FertilizingFields, FinanceEvent, FinancePayload, Payer } from '../../core/finance/types';
import { FARM_FUNDS } from '../../core/finance/types';
import { wrap } from '../../test/render';
import { FarmMateArt } from '../../ui';
import { CareListView } from './care-list-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() }, useLocalSearchParams: () => ({}) }));

let n = 0;
function ev(targetId: string, payload: FinancePayload, base: string | null = null): FinanceEvent {
  n += 1;
  return { id: `c${String(n).padStart(4, '0')}`, groupId: 'g', deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: 'd' }, source: 'app', targetId, baseEventId: base, payload };
}
const DAENG: Payer = { id: 'p-daeng', name: 'แดง' };
const item = (id: string, formula: string, sacks: number, net: number) => {
  const fields: ExpenseFields = {
    amountSatang: net, date: '2026-10-05', stage: 'actual', categoryId: 'cat-fertilizer', propertyId: null, item: formula, note: '', payer: { id: FARM_FUNDS, name: '' }, orderId: `o-${id}`,
    line: { qty: sacks, unit: 'กระสอบ', grossSatang: net, itemDiscountSatang: 0 },
    fertilizer: { type: 'chemical', formula, brand: '', sackKg: 50, reasons: [], zones: [], shop: '', orderedBy: '', sacks },
  };
  return ev(id, { t: 'expense_created', fields });
};
const fz = (id: string, f: Partial<FertilizingFields>) =>
  ev(id, { t: 'fertilizing_recorded', fields: { date: '2026-11-01', lines: [], pct: { [DAENG.id]: 50 }, settle: {}, zones: [], reasons: [], note: '', ...f } });

const STOCK = [item('a', 'ดีเกลือ', 60, 1_800_000), item('k', '46-0-0', 20, 1_560_000)];

function setup(events: FinanceEvent[]) {
  const write = jest.fn().mockResolvedValue({});
  const onOpen = jest.fn();
  const onNew = jest.fn();
  wrap(<CareListView events={events} write={write} onOpen={onOpen} onNew={onNew} onBack={jest.fn()} />);
  return { write, onOpen, onNew };
}

describe('CareListView (E16-S01)', () => {
  it('lists fertilizings newest first: date, what and how much, zone, and a worded amber badge when not split (GC-2)', () => {
    setup([
      ...STOCK,
      fz('fz-old', { date: '2026-10-20', lines: [{ sources: ['a'], sacks: 20, takes: [{ worker: DAENG, sacks: 20, auto: false }], rest: null }], zones: [{ zoneId: 'z1', zoneName: 'แปลงหน้า' }] }),
      fz('fz-new', { date: '2026-11-05', lines: [{ sources: ['a'], sacks: 10, takes: [], rest: null }, { sources: ['k'], sacks: 5, takes: [], rest: null }] }),
      fz('fz-mid', { date: '2026-11-01', lines: [{ sources: ['k'], sacks: 8, takes: [{ worker: DAENG, sacks: 3, auto: false }], rest: 'later' }] }),
    ]);
    expect(screen.getAllByTestId(/^care-row-fz-[a-z]+$/).map((r) => r.props.testID)).toEqual(['care-row-fz-new', 'care-row-fz-mid', 'care-row-fz-old']);
    const fresh = screen.getByTestId('care-row-fz-new');
    expect(fresh).toHaveTextContent(/5 พ\.ย\./);
    expect(fresh).toHaveTextContent(/ดีเกลือ 10 · 46-0-0 5 ถุง/);
    expect(within(fresh).getByTestId('care-row-fz-new-badge')).toHaveTextContent('ยังไม่แบ่ง');
    expect(within(screen.getByTestId('care-row-fz-mid')).getByTestId('care-row-fz-mid-badge')).toHaveTextContent('แบ่งไม่ครบ');
    expect(screen.queryByTestId('care-row-fz-old-badge')).toBeNull();
    expect(screen.getByTestId('care-row-fz-old')).toHaveTextContent(/แปลงหน้า/);
    expect(within(fresh).UNSAFE_queryAllByType(FarmMateArt).map((a) => a.props.id)).toEqual(['farmwork.fertilize']);
  });

  it('a fertilizing that used more than was received carries the worded over-use flag (E16-S04 FL-3)', () => {
    setup([
      ...STOCK,
      fz('fz-a', { date: '2026-10-20', lines: [{ sources: ['k'], sacks: 15, takes: [], rest: 'farm' }] }),
      fz('fz-b', { date: '2026-10-21', lines: [{ sources: ['k'], sacks: 8, takes: [], rest: 'farm' }] }),
    ]);
    expect(screen.getByTestId('care-row-fz-b-over')).toHaveTextContent('ใส่เกินที่ได้ของ 3 ถุง');
    expect(screen.queryByTestId('care-row-fz-a-over')).toBeNull();
  });

  it('a row opens that fertilizing; the main button records a new one directly (GC-3)', () => {
    const { onOpen, onNew } = setup([...STOCK, fz('fz-1', { lines: [{ sources: ['a'], sacks: 10, takes: [], rest: null }] })]);
    fireEvent.press(screen.getByTestId('care-row-fz-1'));
    expect(onOpen).toHaveBeenCalledWith('fz-1');
    fireEvent.press(screen.getByTestId('care-new'));
    expect(onNew).toHaveBeenCalled();
  });

  it('empty: says what shows here, with the first-record button (GC-4)', () => {
    const { onNew } = setup(STOCK);
    expect(screen.getByTestId('care-empty')).toHaveTextContent(/การใส่ปุ๋ย/);
    fireEvent.press(screen.getByTestId('care-new'));
    expect(onNew).toHaveBeenCalled();
  });

  it('deleted fertilizings are listed apart and can be restored (GC-5)', async () => {
    const c = fz('fz-gone', { lines: [{ sources: ['a'], sacks: 10, takes: [], rest: null }] });
    const del = ev('fz-gone', { t: 'fertilizing_changed', patch: { deleted: true } }, c.id);
    const { write } = setup([...STOCK, c, del]);
    expect(screen.queryByTestId('care-row-fz-gone')).toBeNull();
    expect(screen.getByTestId('care-deleted')).toHaveTextContent(/ที่ลบแล้ว \(1\)/);
    fireEvent.press(screen.getByTestId('care-restore-fz-gone'));
    await waitFor(() => expect(write).toHaveBeenCalledWith('fz-gone', del.id, { t: 'fertilizing_changed', patch: { deleted: false } }));
  });
});
