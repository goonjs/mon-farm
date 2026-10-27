import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { groupOrders } from '../../../core/finance/fert-order';
import type { Expense, FertOption } from '../../../core/finance/ledger';
import type { MasterState } from '../../../core/master';
import { wrap } from '../../../test/render';
import { OrderDetailView } from './order-detail-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() }, useLocalSearchParams: () => ({}), Link: ({ children }: { children: unknown }) => children }));
jest.mock('../../../store/people', () => ({ peopleStore: { list: () => Promise.resolve([]), addZone: jest.fn(), create: jest.fn() } }));

const FERT = { type: 'chemical', formula: '15-15-15', brand: '', sackKg: 50, reasons: [] as string[], zones: [] as never[], shop: 'ร้านเจริญ', orderedBy: '', sacks: 20 };
const exp = (id: string, over: Partial<Expense> = {}): Expense =>
  ({
    id,
    deleted: false,
    history: [],
    conflicts: [],
    waiting: false,
    headEventId: `ev-${id}`,
    heads: [`ev-${id}`],
    createdOn: 'd',
    amountSatang: 2_300_000,
    discountSatang: 0,
    date: '2026-10-27',
    stage: 'committed',
    categoryId: 'cat-fertilizer',
    propertyId: null,
    item: '15-15-15',
    note: '',
    payer: { id: 'farm', name: 'เงินสวน' },
    orderId: 'o1',
    line: { qty: 20, unit: 'กระสอบ', grossSatang: 2_300_000, itemDiscountSatang: 0 },
    fertilizer: FERT,
    ...over,
  }) as unknown as Expense;

const reasonOpt: FertOption = { id: 'fopt-reason-a', kind: 'reason', name: 'บำรุงต้น', description: 'ก่อนฤดูกรีด', hidden: false };
const state = { expenses: [] as Expense[], categories: [{ id: 'cat-fertilizer', name: 'ปุ๋ย', workerPct: 50 }], fertOptions: [reasonOpt], repayments: [], reimbursements: [] } as never;
const master = {
  people: [{ id: 'p1', name: 'แดง', roles: ['tapper'], deleted: false }, { id: 'p2', name: 'นัด', roles: ['tapper'], deleted: false }],
  properties: [{ id: 'f1', name: 'สวนบ้านบน', deleted: false }],
  zones: [{ id: 'z1', name: 'แปลงหน้า', propertyId: 'f1', hidden: false }, { id: 'z2', name: 'แปลงหลัง', propertyId: 'f1', hidden: false }],
} as unknown as MasterState;

function setup(items: Expense[]) {
  const write = jest.fn().mockResolvedValue({});
  const order = groupOrders(items)[0];
  wrap(<OrderDetailView order={order} fin={{ events: [], state: state as never, write }} master={master} onZoneSaved={jest.fn()} onBack={jest.fn()} onRepeat={jest.fn()} />);
  return write;
}
const keys = (id: string, ...ks: string[]) => ks.forEach((k) => fireEvent.press(screen.getByTestId(`${id}-pad-key-${k}`)));

describe('OrderDetailView', () => {
  const a = exp('o1-a');
  const b = exp('o1-b', { item: 'ขี้ไก่', categoryId: 'cat-manure', fertilizer: null, line: { qty: 30, unit: 'กระสอบ', grossSatang: 1_950_000, itemDiscountSatang: 0 }, amountSatang: 1_950_000 });

  it('header shows the total, stage and progress; a non-fertilizer item has no tell buttons', () => {
    setup([a, b]);
    expect(screen.getByTestId('ordd-total').props.children).toBe('42,500.00');
    expect(screen.getByText('สั่งไว้')).toBeTruthy();
    expect(screen.getByTestId('ordd-progress').props.children).toContain('บอกแล้ว 0 จาก 1');
    expect(screen.getByTestId('ordd-o1-a-reasons').props.accessibilityState.selected).toBe(false);
    expect(screen.queryByTestId('ordd-o1-b-reasons')).toBeNull();
  });

  it('"ของมาแล้ว" writes actual on every item, one write each, naming each head', async () => {
    const write = setup([a, b]);
    fireEvent.press(screen.getByTestId('ordd-deliver'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    expect(write).toHaveBeenCalledWith('o1-a', 'ev-o1-a', { t: 'expense_changed', patch: { stage: 'actual' } });
  });

  it('an order already received shows no "ของมาแล้ว"', () => {
    setup([exp('o1-a', { stage: 'actual' })]);
    expect(screen.queryByTestId('ordd-deliver')).toBeNull();
  });

  it('reasons: tick, then เสร็จ patches the fertilizer object whole', async () => {
    const write = setup([a]);
    fireEvent.press(screen.getByTestId('ordd-o1-a-reasons'));
    fireEvent.press(screen.getByTestId('ordd-reason-fopt-reason-a'));
    expect(screen.getByText('เสร็จ · เลือก 1 ข้อ')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ordd-reasons-done'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(write.mock.calls[0][2].patch.fertilizer).toEqual({ ...FERT, reasons: ['fopt-reason-a'] });
  });

  it('zones: a QuantityField per zone, summary warns when less, over the sacks blocks เสร็จ', async () => {
    const write = setup([a]);
    fireEvent.press(screen.getByTestId('ordd-o1-a-zones'));
    expect(screen.getByTestId('ordd-zones-sum')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ordd-zone-z1'));
    keys('ordd-zone-z1', '1', '2', 'done');
    expect(screen.getByText('ใส่แล้ว 12 / 20 กระสอบ')).toBeTruthy();
    expect(screen.getByText('เหลือ 8 ยังไม่ใส่')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ordd-zone-z2'));
    keys('ordd-zone-z2', '1', '0', 'done');
    expect(screen.getByText('ใส่เกิน 20 กระสอบที่ซื้อ')).toBeTruthy();
    expect(screen.getByTestId('ordd-zones-done').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('ordd-zone-z2'));
    keys('ordd-zone-z2', '8', 'done');
    fireEvent.press(screen.getByTestId('ordd-zones-done'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const patch = write.mock.calls[0][2].patch;
    expect(patch.fertilizer.zones.map((z: { zoneId: string; sacks: number }) => [z.zoneId, z.sacks])).toEqual([['z1', 12], ['z2', 8]]);
    expect(patch.propertyId).toBe('f1');
  });

  it('tappers: add one (gets all sacks), engine split shown, committed hint, share + net amount written together', async () => {
    const write = setup([a]);
    fireEvent.press(screen.getByTestId('ordd-o1-a-tappers'));
    fireEvent.press(screen.getByTestId('ordd-tap-add'));
    fireEvent.press(screen.getByTestId('ordd-pick-p1'));
    expect(screen.getByText('แบ่งแล้ว 20 / 20')).toBeTruthy();
    expect(screen.getByTestId('ordd-tap-p1-part').props.children).toBe('แดงรับส่วนนี้ 11,500.00');
    expect(screen.getByTestId('ordd-tap-hint')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ordd-tap-p1-sacks'));
    keys('ordd-tap-p1-sacks', '6', 'done');
    expect(screen.getByText('เหลือ 14 ใช้เอง')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ordd-tap-done'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(write.mock.calls[0][2].patch).toEqual({
      share: { billSatang: 2_300_000, discountSatang: 0, totalSacks: 20, lines: [{ worker: { id: 'p1', name: 'แดง' }, sacks: 6, workerPct: 50, settle: 'debt' }] },
      amountSatang: 2_300_000,
    });
  });

  it('tappers: "ไม่แบ่ง" writes share null, and the button then reads as told', async () => {
    const write = setup([a]);
    fireEvent.press(screen.getByTestId('ordd-o1-a-tappers'));
    fireEvent.press(screen.getByTestId('ordd-tap-none'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(write.mock.calls[0][2].patch.share).toBeNull();
  });

  it('a tapper line opens the % / settle choice', () => {
    setup([exp('o1-a', { share: { billSatang: 2_300_000, discountSatang: 0, totalSacks: 20, lines: [{ worker: { id: 'p1', name: 'แดง' }, sacks: 6, workerPct: 50, settle: 'debt' }] } })]);
    fireEvent.press(screen.getByTestId('ordd-o1-a-tappers'));
    expect(screen.getByText('50% · หักตอนขายยาง')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ordd-tap-p1-chip'));
    fireEvent.press(screen.getByTestId('ordd-tap-settle-paid'));
    fireEvent.press(screen.getByTestId('ordd-tap-pct-done'));
    expect(screen.getByText('50% · จ่ายสดแล้ว')).toBeTruthy();
  });
});
