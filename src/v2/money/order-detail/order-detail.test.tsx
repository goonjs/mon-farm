import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';

import { groupOrders, type OrderView } from '../../../core/finance/fert-order';
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

function setup(items: Expense[], deleted: Expense[] = []) {
  const write = jest.fn().mockResolvedValue({});
  const order = groupOrders(items)[0] ?? ({ orderId: 'o1', legacy: false, items: [], date: '2026-10-27', stage: 'committed', payer: null, shop: '', netSatang: 0, billDiscountSatang: 0, consistent: true } as OrderView);
  const st = { ...(state as object), expenses: [...items, ...deleted] } as never;
  wrap(<OrderDetailView order={order} fin={{ events: [], state: st, write }} master={master} onZoneSaved={jest.fn()} onBack={jest.fn()} onRepeat={jest.fn()} />);
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

  it('reasons: a quiet link leads to ตั้งค่าปุ๋ย, the only way to manage reasons, formulas and brands', () => {
    setup([a]);
    fireEvent.press(screen.getByTestId('ordd-o1-a-reasons'));
    fireEvent.press(screen.getByTestId('ordd-reasons-manage'));
    const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };
    expect(router.push).toHaveBeenCalledWith('/v2/fertilizer-settings');
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

  it('edit item: a new quantity follows the unit price; one patch with amount, discount, line and fertilizer', async () => {
    const write = setup([a]);
    fireEvent.press(screen.getByTestId('ordd-o1-a-edit'));
    fireEvent.press(screen.getByTestId('ordd-edit-qty'));
    keys('ordd-edit-qty', '2', '5', 'done');
    expect(screen.getByTestId('ordd-edit-total').props.children).toBe('28,750.00');
    fireEvent.press(screen.getByTestId('ordd-edit-save'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(write.mock.calls[0][0]).toBe('o1-a');
    expect(write.mock.calls[0][1]).toBe('ev-o1-a');
    const patch = write.mock.calls[0][2].patch;
    expect(patch).toMatchObject({ amountSatang: 2_875_000, discountSatang: 0, line: { qty: 25, unit: 'กระสอบ', grossSatang: 2_875_000, itemDiscountSatang: 0 } });
    expect(patch.fertilizer).toMatchObject({ sacks: 25, pricePerSackSatang: 115_000 });
    expect(patch.share).toBeUndefined();
  });

  it('edit item: an existing share is rebuilt in the same patch', async () => {
    const lines = [{ worker: { id: 'p1', name: 'แดง' }, sacks: 6, workerPct: 50, settle: 'debt' as const }];
    const write = setup([exp('o1-a', { share: { billSatang: 2_300_000, discountSatang: 0, totalSacks: 20, lines } })]);
    fireEvent.press(screen.getByTestId('ordd-o1-a-edit'));
    fireEvent.press(screen.getByTestId('ordd-edit-qty'));
    keys('ordd-edit-qty', '2', '5', 'done');
    fireEvent.press(screen.getByTestId('ordd-edit-save'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const patch = write.mock.calls[0][2].patch;
    expect(patch.share).toEqual({ billSatang: 2_875_000, discountSatang: 0, totalSacks: 25, lines });
    expect(patch.amountSatang).toBe(2_875_000);
  });

  it('edit item: a quantity below the sacks given to tappers is blocked with a message, nothing is written', async () => {
    const lines = [{ worker: { id: 'p1', name: 'แดง' }, sacks: 12, workerPct: 50, settle: 'debt' as const }];
    const write = setup([exp('o1-a', { share: { billSatang: 2_300_000, discountSatang: 0, totalSacks: 20, lines } })]);
    fireEvent.press(screen.getByTestId('ordd-o1-a-edit'));
    fireEvent.press(screen.getByTestId('ordd-edit-qty'));
    keys('ordd-edit-qty', '5', 'done');
    expect(screen.getByTestId('ordd-edit-err-tappers')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ordd-edit-save'));
    await new Promise((r) => setTimeout(r, 0));
    expect(write).not.toHaveBeenCalled();
  });

  it('delete item: confirm first, then deleted: true on that item only', async () => {
    const write = setup([a, b]);
    fireEvent.press(screen.getByTestId('ordd-o1-b-edit'));
    fireEvent.press(screen.getByTestId('ordd-edit-delete'));
    expect(write).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('ordd-delete-item-sheet-yes'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(write).toHaveBeenCalledWith('o1-b', 'ev-o1-b', { t: 'expense_changed', patch: { deleted: true } });
  });

  it('delete whole order: confirm, then deleted: true on every item', async () => {
    const write = setup([a, b]);
    fireEvent.press(screen.getByTestId('ordd-delete-order'));
    expect(write).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('ordd-delete-order-sheet-yes'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    expect(write).toHaveBeenCalledWith('o1-a', 'ev-o1-a', { t: 'expense_changed', patch: { deleted: true } });
    expect(write).toHaveBeenCalledWith('o1-b', 'ev-o1-b', { t: 'expense_changed', patch: { deleted: true } });
  });

  it('deleted items are listed at the bottom with a restore button; an all-deleted order still opens', async () => {
    const gone = exp('o1-b', { deleted: true, item: 'ขี้ไก่' });
    const write = setup([], [gone]);
    expect(screen.getByTestId('ordd-all-deleted')).toBeTruthy();
    expect(screen.getByText('ที่ลบแล้ว (1)')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ordd-restore-o1-b'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(write).toHaveBeenCalledWith('o1-b', 'ev-o1-b', { t: 'expense_changed', patch: { deleted: false } });
  });

  it('an item with a conflict shows "ขัดกัน" that opens the expense form', () => {
    setup([exp('o1-a', { conflicts: [{ field: 'amountSatang', values: [] }] as never }), b]);
    expect(screen.queryByTestId('ordd-o1-b-conflict')).toBeNull();
    fireEvent.press(screen.getByTestId('ordd-o1-a-conflict'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/v2/expense/[id]', params: { id: 'o1-a' } });
  });

  it('a planned order: the header shows the real stage, offers three, and saving without changing it never writes a stage', async () => {
    const write = setup([exp('o1-a', { stage: 'planned' })]);
    expect(screen.getByText('แค่วางแผน')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ordd-edit-header'));
    expect(screen.getByTestId('ordd-hdr-stage-planned')).toBeTruthy();
    expect(screen.getByTestId('ordd-hdr-stage-planned').props.accessibilityState.checked).toBe(true);
    fireEvent.press(screen.getByTestId('ordd-hdr-shop'));
    fireEvent.changeText(screen.getByTestId('ordd-hdr-shop'), 'ร้านใหม่');
    fireEvent.press(screen.getByTestId('ordd-hdr-save'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(write.mock.calls[0][2].patch.stage).toBeUndefined();
    expect(write.mock.calls[0][2].patch.fertilizer.shop).toBe('ร้านใหม่');
  });

  it('a committed order offers two stages; choosing "ได้ของแล้ว" writes actual', async () => {
    const write = setup([a]);
    fireEvent.press(screen.getByTestId('ordd-edit-header'));
    expect(screen.queryByTestId('ordd-hdr-stage-planned')).toBeNull();
    fireEvent.press(screen.getByTestId('ordd-hdr-stage-actual'));
    fireEvent.press(screen.getByTestId('ordd-hdr-save'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(write.mock.calls[0][2].patch.stage).toBe('actual');
  });

  it('mismatch fix keeps the order\'s own stage (planned stays planned)', async () => {
    const write = setup([exp('o1-a', { stage: 'actual', date: '2026-10-20' }), exp('o1-b', { stage: 'planned', date: '2026-10-27' })]);
    fireEvent.press(screen.getByTestId('ordd-mismatch-fix'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(write.mock.calls[0][0]).toBe('o1-a');
    expect(write.mock.calls[0][2].patch).toEqual({ date: '2026-10-27', stage: 'planned' });
  });
});
