import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ExpenseFields, FertilizingFields, FinanceEvent, FinancePayload, Payer } from '../../../core/finance/types';
import { FARM_FUNDS } from '../../../core/finance/types';
import { wrap } from '../../../test/render';
import { FertilizingView } from './fertilizing-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() }, useLocalSearchParams: () => ({}) }));

let n = 0;
function ev(targetId: string, payload: FinancePayload, base: string | null = null): FinanceEvent {
  n += 1;
  return { id: `u${String(n).padStart(4, '0')}`, groupId: 'g', deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: 'd' }, source: 'app', targetId, baseEventId: base, payload };
}

const FARM: Payer = { id: FARM_FUNDS, name: 'เงินสวน' };
const DAENG: Payer = { id: 'p-daeng', name: 'แดง' };
const DAM: Payer = { id: 'p-dam', name: 'ดำ' };
const SOMCHAI: Payer = { id: 'p-somchai', name: 'สมชาย' };
const TAPPERS = [DAENG, DAM, SOMCHAI];

function item(id: string, o: { sacks: number; netSatang: number; formula?: string; stage?: 'actual' | 'committed'; date?: string; shop?: string }) {
  const fields: ExpenseFields = {
    amountSatang: o.netSatang,
    date: o.date ?? '2026-10-05',
    stage: o.stage ?? 'actual',
    categoryId: 'cat-fertilizer',
    propertyId: null,
    item: o.formula ?? 'ดีเกลือ',
    note: '',
    payer: FARM,
    orderId: `ord-${id}`,
    discountSatang: 0,
    line: { qty: o.sacks, unit: 'กระสอบ', grossSatang: o.netSatang, itemDiscountSatang: 0 },
    fertilizer: { type: 'chemical', formula: o.formula ?? 'ดีเกลือ', brand: '', sackKg: 50, reasons: [], zones: [], shop: o.shop ?? 'ร้าน ก.', orderedBy: '', sacks: o.sacks },
  };
  return ev(id, { t: 'expense_created', fields });
}

const STOCK = [item('a', { sacks: 60, netSatang: 1_800_000 }), item('k', { sacks: 20, netSatang: 1_560_000, formula: '46-0-0' })];
const ZONES = [{ zoneId: 'z1', zoneName: 'แปลงแดง' }, { zoneId: 'z2', zoneName: 'แปลงดำ' }];

function setup(events: FinanceEvent[] = STOCK, o: { recordId?: string | null; fromOrder?: string } = {}) {
  const write = jest.fn().mockResolvedValue({});
  const onDone = jest.fn();
  wrap(
    <FertilizingView
      events={events}
      tappers={TAPPERS}
      zones={ZONES}
      recordId={o.recordId ?? null}
      fromOrder={o.fromOrder ?? null}
      today="2026-11-08"
      write={write}
      onDone={onDone}
      onBack={jest.fn()}
      onOrders={jest.fn()}
    />,
  );
  return { write, onDone };
}
const keys = (id: string, ...ks: string[]) => {
  fireEvent.press(screen.getByTestId(id));
  ks.forEach((k) => fireEvent.press(screen.getByTestId(`${id}-pad-key-${k}`)));
};
const payloadOf = (write: jest.Mock) => write.mock.calls[0][2] as { t: string; fields: FertilizingFields };

describe('FertilizingView — main page (FZ-1)', () => {
  it('starts today, nothing chosen, save off', () => {
    setup();
    expect(screen.getByTestId('fz-date')).toHaveTextContent(/8 พ\.ย\./);
    expect(screen.getByTestId('fz-ferts')).toHaveTextContent(/เลือกปุ๋ยที่ใส่\ ·\ แบ่งคนกรีด/);
    expect(screen.getByTestId('fz-where')).toHaveTextContent(/ไม่บังคับ · เลือกทีหลังได้/);
    expect(screen.getByTestId('fz-save').props.accessibilityState.disabled).toBe(true);
  });
});

describe('FertilizingView — fertilizer page (FZ-2, FZ-3, FZ-4, FZ-9, SP-*)', () => {
  it('lists delivered stock as cards; orders not delivered are not cards but one row', () => {
    setup([...STOCK, item('c', { sacks: 50, netSatang: 1_000_000, formula: 'ขี้ไก่', stage: 'committed' })]);
    fireEvent.press(screen.getByTestId('fz-ferts'));
    const keys_ = screen.getAllByTestId(/^fz-card-[^-]+$/).map((c) => c.props.testID);
    expect(keys_).toHaveLength(2);
    expect(screen.getByText('300 ฿/ถุง')).toBeTruthy();
    expect(screen.getByText('780 ฿/ถุง')).toBeTruthy();
    expect(screen.getByTestId('fz-ordered')).toHaveTextContent(/ขี้ไก่ 50 ถุง/);
    expect(screen.getByTestId('fz-apply')).toHaveTextContent('ยังไม่ได้เลือก');
  });

  it('empty stock says when fertilizer shows up', () => {
    setup([item('c', { sacks: 50, netSatang: 1_000_000, stage: 'committed' })]);
    fireEvent.press(screen.getByTestId('fz-ferts'));
    expect(screen.getByTestId('fz-empty')).toHaveTextContent(/ไม่มีปุ๋ยในสต็อก/);
  });

  it('+ uses all the stock, tappers start at 0, the last untouched one is filled', async () => {
    const { write } = setup();
    fireEvent.press(screen.getByTestId('fz-ferts'));
    fireEvent.press(screen.getByTestId('fz-card-0'));
    expect(screen.getByTestId('fz-card-0-sacks')).toHaveTextContent(/60/);
    expect(screen.getByTestId(`fz-card-0-take-${DAENG.id}`)).toHaveTextContent(/0/);
    keys(`fz-card-0-take-${DAENG.id}`, '2', '5', 'done');
    keys(`fz-card-0-take-${DAM.id}`, '2', '0', 'done');
    expect(screen.getByTestId(`fz-card-0-take-${SOMCHAI.id}`)).toHaveTextContent(/15/);
    expect(screen.getByTestId(`fz-card-0-auto-${SOMCHAI.id}`)).toHaveTextContent('เติมให้');
    expect(screen.getByTestId('fz-card-0-given')).toHaveTextContent('แบ่งให้คนกรีดรวม 60 ถุง');
    fireEvent.press(screen.getByTestId('fz-apply'));
    expect(screen.getByTestId('fz-ferts')).toHaveTextContent(/ดีเกลือ\ 300฿\ ·\ 60\ ถุง\ ·\ แบ่งครบ/);
    fireEvent.press(screen.getByTestId('fz-save'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const [target, base] = write.mock.calls[0];
    expect(target).toMatch(/^fz-/);
    expect(base).toBeNull();
    const p = payloadOf(write);
    expect(p.t).toBe('fertilizing_recorded');
    expect(p.fields.date).toBe('2026-11-08');
    expect(p.fields.lines).toEqual([
      {
        sources: ['a'],
        sacks: 60,
        takes: [
          { worker: DAENG, sacks: 25, auto: false },
          { worker: DAM, sacks: 20, auto: false },
          { worker: SOMCHAI, sacks: 15, auto: true },
        ],
        rest: null,
      },
    ]);
  });

  it('shows each tapper their cost and debt (SP-5)', () => {
    setup();
    fireEvent.press(screen.getByTestId('fz-ferts'));
    fireEvent.press(screen.getByTestId('fz-card-0'));
    keys(`fz-card-0-take-${DAENG.id}`, '2', '5', 'done');
    expect(screen.getByTestId(`fz-card-0-cost-${DAENG.id}`)).toHaveTextContent(/ค่าปุ๋ย ฿\s?7,500/);
    expect(screen.getByTestId(`fz-card-0-debt-${DAENG.id}`)).toHaveTextContent(/เป็นหนี้ ฿\s?3,750/);
  });

  it('more than in stock turns the field red and blocks applying', () => {
    setup();
    fireEvent.press(screen.getByTestId('fz-ferts'));
    fireEvent.press(screen.getByTestId('fz-card-0'));
    keys('fz-card-0-sacks', '6', '1', 'done');
    expect(screen.getByTestId('fz-card-0-over')).toHaveTextContent('เกินที่มี 1 ถุง');
    expect(screen.getByTestId('fz-apply').props.accessibilityState.disabled).toBe(true);
  });

  it('"ไม่ใส่อันนี้" puts the card back; "ใช้ทั้งหมด" uses every card in full', () => {
    setup();
    fireEvent.press(screen.getByTestId('fz-ferts'));
    fireEvent.press(screen.getByTestId('fz-card-0'));
    fireEvent.press(screen.getByTestId('fz-card-0-skip'));
    expect(screen.getByTestId('fz-apply')).toHaveTextContent('ยังไม่ได้เลือก');
    fireEvent.press(screen.getByTestId('fz-use-all'));
    expect(screen.getByTestId('fz-apply')).toHaveTextContent('ใช้ปุ๋ย 2 อย่าง');
  });

  it('part split asks per card: give back to stock lowers the sacks (SP-6b)', () => {
    setup();
    fireEvent.press(screen.getByTestId('fz-ferts'));
    fireEvent.press(screen.getByTestId('fz-card-0'));
    keys(`fz-card-0-take-${DAENG.id}`, '5', '0', 'done');
    fireEvent.press(screen.getByTestId('fz-apply'));
    expect(screen.getByTestId('fz-partial-sheet')).toHaveTextContent(/ดีเกลือ 300฿ ยังแบ่งไม่ครบ/);
    expect(screen.getByTestId('fz-partial-sheet')).toHaveTextContent(/เหลือ 10 ถุง ไม่มีใครรับ/);
    fireEvent.press(screen.getByTestId('fz-partial-return'));
    expect(screen.getByTestId('fz-ferts')).toHaveTextContent(/ดีเกลือ\ 300฿\ ·\ 50\ ถุง\ ·\ แบ่งครบ/);
  });

  it('"สวนใส่เอง" keeps the sacks and counts as fully split', () => {
    setup();
    fireEvent.press(screen.getByTestId('fz-ferts'));
    fireEvent.press(screen.getByTestId('fz-card-0'));
    keys(`fz-card-0-take-${DAENG.id}`, '5', '0', 'done');
    fireEvent.press(screen.getByTestId('fz-apply'));
    fireEvent.press(screen.getByTestId('fz-partial-farm'));
    expect(screen.getByTestId('fz-ferts')).toHaveTextContent(/ดีเกลือ\ 300฿\ ·\ 60\ ถุง\ ·\ แบ่งครบ/);
  });

  it('nobody split is saved without asking (SP-6)', () => {
    setup();
    fireEvent.press(screen.getByTestId('fz-ferts'));
    fireEvent.press(screen.getByTestId('fz-card-1'));
    fireEvent.press(screen.getByTestId('fz-apply'));
    expect(screen.queryByTestId('fz-partial-sheet')).toBeNull();
    expect(screen.getByTestId('fz-ferts')).toHaveTextContent(/46\-0\-0\ 780฿\ ·\ 20\ ถุง\ ·\ ยังไม่แบ่ง/);
  });

  it('✕ with something chosen asks to drop it', () => {
    setup();
    fireEvent.press(screen.getByTestId('fz-ferts'));
    fireEvent.press(screen.getByTestId('fz-card-0'));
    fireEvent.press(screen.getByTestId('fz-cards-close'));
    expect(screen.getByTestId('fz-discard-sheet')).toBeTruthy();
    fireEvent.press(screen.getByTestId('fz-discard-sheet-yes'));
    expect(screen.getByTestId('fz-ferts')).toHaveTextContent(/เลือกปุ๋ยที่ใส่\ ·\ แบ่งคนกรีด/);
  });

  it('a tapper % and how they pay back are set from their debt line (SP-7)', () => {
    setup();
    fireEvent.press(screen.getByTestId('fz-ferts'));
    fireEvent.press(screen.getByTestId('fz-card-0'));
    keys(`fz-card-0-take-${DAENG.id}`, '2', '5', 'done');
    fireEvent.press(screen.getByTestId(`fz-card-0-debt-${DAENG.id}`));
    keys('fz-pct-value', '4', '0', 'done');
    fireEvent.press(screen.getByTestId('fz-pct-done'));
    expect(screen.getByTestId(`fz-card-0-debt-${DAENG.id}`)).toHaveTextContent(/เป็นหนี้ ฿\s?3,000/);
  });

  it('starts with the cards of one order when opened from it (RM-1)', () => {
    setup(STOCK, { fromOrder: 'ord-k' });
    expect(screen.getByTestId('fz-ferts')).toHaveTextContent(/46\-0\-0\ 780฿\ ·\ 20\ ถุง\ ·\ ยังไม่แบ่ง/);
  });
});

describe('FertilizingView — zones and reasons (FZ-6)', () => {
  it('picks zones and reasons on their own page, per fertilizing', async () => {
    const { write } = setup();
    fireEvent.press(screen.getByTestId('fz-ferts'));
    fireEvent.press(screen.getByTestId('fz-card-1'));
    fireEvent.press(screen.getByTestId('fz-apply'));
    fireEvent.press(screen.getByTestId('fz-where'));
    fireEvent.press(screen.getByTestId('fz-zone-z1'));
    fireEvent.press(screen.getByTestId('fz-reason-new'));
    fireEvent.changeText(screen.getByTestId('fz-reason-text'), 'บำรุงต้น');
    fireEvent.press(screen.getByTestId('fz-reason-add'));
    await screen.findByTestId('fz-reason-new');
    fireEvent.press(screen.getByTestId('fz-where-done'));
    expect(screen.getByTestId('fz-where')).toHaveTextContent(/แปลงแดง/);
    fireEvent.press(screen.getByTestId('fz-save'));
    await waitFor(() => expect(write).toHaveBeenCalled());
    const call = write.mock.calls.find((c) => (c[2] as { t: string }).t === 'fertilizing_recorded')!;
    expect((call[2] as { fields: FertilizingFields }).fields.zones).toEqual([{ zoneId: 'z1', zoneName: 'แปลงแดง' }]);
    // A new reason is remembered for next time (as on the order before E11-S17).
    const opt = write.mock.calls.find((c) => (c[2] as { t: string }).t === 'fert_option_set')!;
    expect(opt[2]).toMatchObject({ kind: 'reason', name: 'บำรุงต้น' });
    expect((call[2] as { fields: FertilizingFields }).fields.reasons).toEqual([opt[0]]);
  });
});

describe('FertilizingView — edit, delete (FZ-7, FZ-9)', () => {
  const saved = (): FinanceEvent[] => [
    ...STOCK,
    ev('fz-1', {
      t: 'fertilizing_recorded',
      fields: { date: '2026-11-01', lines: [{ sources: ['a'], sacks: 40, takes: [{ worker: DAENG, sacks: 40, auto: false }], rest: null }], pct: { [DAENG.id]: 50 }, settle: {}, zones: [], reasons: [], note: '' },
    }),
  ];

  it('reopens with its numbers; stock leaves its own sacks out; saving patches the lines', async () => {
    const events = saved();
    const { write } = setup(events, { recordId: 'fz-1' });
    expect(screen.getByTestId('fz-ferts')).toHaveTextContent(/ดีเกลือ\ 300฿\ ·\ 40\ ถุง\ ·\ แบ่งครบ/);
    fireEvent.press(screen.getByTestId('fz-ferts'));
    expect(screen.getByTestId('fz-card-0-stock')).toHaveTextContent('60');
    // Fully split, so it waits closed: "ใส่ 40 ถุง · แบ่งครบ".
    expect(screen.getByTestId('fz-card-0-expand')).toHaveTextContent(/ใส่ 40 ถุง · แบ่งครบ/);
    fireEvent.press(screen.getByTestId('fz-card-0-expand'));
    keys('fz-card-0-sacks', '4', '5', 'done');
    fireEvent.press(screen.getByTestId('fz-apply'));
    fireEvent.press(screen.getByTestId('fz-partial-farm'));
    fireEvent.press(screen.getByTestId('fz-save'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const [target, base, payload] = write.mock.calls[0];
    expect(target).toBe('fz-1');
    expect(base).toBe(events[events.length - 1].id);
    expect(payload.t).toBe('fertilizing_changed');
    expect(Object.keys(payload.patch)).toEqual(['lines']);
    expect(payload.patch.lines[0]).toMatchObject({ sacks: 45, rest: 'farm' });
  });

  it('delete asks first, then writes deleted (FZ-7)', async () => {
    const events = saved();
    const { write } = setup(events, { recordId: 'fz-1' });
    fireEvent.press(screen.getByTestId('fz-delete'));
    fireEvent.press(screen.getByTestId('fz-delete-sheet-yes'));
    await waitFor(() => expect(write).toHaveBeenCalledWith('fz-1', events[events.length - 1].id, { t: 'fertilizing_changed', patch: { deleted: true } }));
  });
});
