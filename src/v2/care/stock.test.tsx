import { fireEvent, screen, within } from '@testing-library/react-native';

import type { ExpenseFields, FinanceEvent, FinancePayload, Payer } from '../../core/finance/types';
import { FARM_FUNDS } from '../../core/finance/types';
import { wrap } from '../../test/render';
import { FarmMateArt } from '../../ui';
import { StockView } from './stock-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() }, useLocalSearchParams: () => ({}) }));

let n = 0;
function ev(targetId: string, payload: FinancePayload): FinanceEvent {
  n += 1;
  return { id: `s${String(n).padStart(4, '0')}`, groupId: 'g', deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: 'd' }, source: 'app', targetId, baseEventId: null, payload };
}
const DAENG: Payer = { id: 'p-daeng', name: 'แดง' };
const item = (id: string, o: { formula: string; sacks: number; perSack: number; shop: string; date: string; stage?: 'actual' | 'committed' }) => {
  const net = o.sacks * o.perSack * 100;
  const fields: ExpenseFields = {
    amountSatang: net, date: o.date, stage: o.stage ?? 'actual', categoryId: 'cat-fertilizer', propertyId: null, item: o.formula, note: '', payer: { id: FARM_FUNDS, name: '' }, orderId: `o-${id}`,
    line: { qty: o.sacks, unit: 'กระสอบ', grossSatang: net, itemDiscountSatang: 0 },
    fertilizer: { type: 'chemical', formula: o.formula, brand: '', sackKg: 50, reasons: [], zones: [], shop: o.shop, orderedBy: '', sacks: o.sacks },
  };
  return ev(id, { t: 'expense_created', fields });
};
const used = (id: string, date: string, sources: string[], sacks: number) =>
  ev(id, { t: 'fertilizing_recorded', fields: { date, lines: [{ sources, sacks, takes: [{ worker: DAENG, sacks, auto: false }], rest: null }], pct: { [DAENG.id]: 50 }, settle: {}, zones: [], reasons: [], note: '' } });

function setup(events: FinanceEvent[]) {
  const onOpen = jest.fn();
  const onOrders = jest.fn();
  wrap(<StockView events={events} onOpen={onOpen} onOrders={onOrders} onBack={jest.fn()} />);
  return { onOpen, onOrders };
}

describe('StockView — ปุ๋ยคงเหลือ (E16-S04)', () => {
  it('one row per card: name, price per sack, what is left, and which orders it came from (FL-1, FL-2)', () => {
    setup([
      item('a', { formula: 'ดีเกลือ', sacks: 60, perSack: 300, shop: 'ร้าน ก.', date: '2026-10-02' }),
      item('b', { formula: 'ดีเกลือ', sacks: 40, perSack: 300, shop: 'ร้าน ข.', date: '2026-10-09' }),
      item('k', { formula: '46-0-0', sacks: 20, perSack: 780, shop: 'ร้าน ก.', date: '2026-10-09' }),
      used('fz-1', '2026-10-20', ['a', 'b'], 70),
    ]);
    const row = screen.getByTestId('stock-card-0');
    expect(row).toHaveTextContent(/ดีเกลือ/);
    expect(row).toHaveTextContent(/300 ฿\/ถุง/);
    expect(within(row).getByTestId('stock-card-0-left')).toHaveTextContent('30');
    expect(row).toHaveTextContent(/ร้าน ก\. 2 ต\.ค\. · ร้าน ข\. 9 ต\.ค\./);
    expect(within(screen.getByTestId('stock-card-1')).getByTestId('stock-card-1-left')).toHaveTextContent('20');
    expect(within(screen.getByTestId('stock')).UNSAFE_queryAllByType(FarmMateArt).map((a) => a.props.id)).toContain('materials.stock');
  });

  it('a card used up is not listed; orders not received are one line apart (FL-2)', () => {
    const { onOrders } = setup([
      item('a', { formula: 'ดีเกลือ', sacks: 10, perSack: 300, shop: 'ร้าน ก.', date: '2026-10-02' }),
      used('fz-1', '2026-10-20', ['a'], 10),
      item('c', { formula: 'ขี้ไก่', sacks: 50, perSack: 100, shop: 'ร้าน ค.', date: '2026-11-01', stage: 'committed' }),
    ]);
    expect(screen.queryByTestId('stock-card-0')).toBeNull();
    expect(screen.getByTestId('stock-ordered')).toHaveTextContent(/สั่งไว้ยังไม่ได้ของ/);
    expect(screen.getByTestId('stock-ordered')).toHaveTextContent(/ขี้ไก่ 50 ถุง/);
    fireEvent.press(screen.getByTestId('stock-ordered'));
    expect(onOrders).toHaveBeenCalled();
  });

  it('used more than received: a worded amber flag that opens the fertilizing to fix (FL-3)', () => {
    const { onOpen } = setup([
      item('a', { formula: 'ดีเกลือ', sacks: 10, perSack: 300, shop: 'ร้าน ก.', date: '2026-10-02' }),
      used('fz-1', '2026-10-20', ['a'], 8),
      used('fz-2', '2026-10-21', ['a'], 5),
    ]);
    const flag = screen.getByTestId('stock-card-0-over');
    expect(flag).toHaveTextContent('ใส่เกินที่ได้ของ 3 ถุง');
    fireEvent.press(flag);
    expect(onOpen).toHaveBeenCalledWith('fz-2');
  });

  it('nothing in stock says so', () => {
    setup([]);
    expect(screen.getByTestId('stock-empty')).toHaveTextContent('ไม่มีปุ๋ยในสต็อก');
  });
});
