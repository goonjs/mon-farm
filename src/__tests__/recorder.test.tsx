import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import CounterScreen from '../app/sale/[id]/counter';
import { LogBuilder } from '../core/fixtures';
import { peopleStore as mockMaster } from '../store/people';
import { SpeechProvider } from '../speech';
import { SaleProvider } from '../store/SaleProvider';
import { store as mockEventStore } from '../store/store';
import { wrap } from '../test/render';

jest.mock('../store/people', () => {
  const actual = jest.requireActual('../store/master-store');
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { ...actual, peopleStore: new MemoryPeopleStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Farm จันทเขลม: จุด 1, จุด 2 → แดง. A sale weighing at จุด 1, with or without a price. */
async function setup(saleId: string, price: number | null) {
  await mockMaster.updateSettings({ zeroCheck: 'skip' });
  const farm = await mockMaster.addProperty({ name: 'จันทเขลม', crop: 'rubber' });
  const p1 = await mockMaster.addPoint(farm.id, `จุด 1 ${saleId}`);
  const p2 = await mockMaster.addPoint(farm.id, `จุด 2 ${saleId}`);
  const red = await mockMaster.create('แดง', ['tapper']);
  await mockMaster.assignTapper(p1.id, red.id, null);
  await mockMaster.assignTapper(p2.id, red.id, null);
  const b = new LogBuilder(saleId)
    .sys({ t: 'sale_started', farmName: '', buyer: 'ล้ง', manager: '', workerLead: '', where: 'farm' })
    .sys({ t: 'numbering_set', numbering: 'per-tapper' });
  if (price !== null) b.sys({ t: 'price_set', satangPerKg: price, indexRef: '' });
  b.sys({ t: 'zone_added', zoneId: farm.id, name: farm.name })
    .sys({ t: 'pile_added', pileId: p1.id, zoneId: farm.id, name: p1.name, tareG: 2_000, stdNetG: 50_000 })
    .sys({ t: 'pile_added', pileId: p2.id, zoneId: farm.id, name: p2.name, tareG: 2_000, stdNetG: 50_000 })
    .sys({ t: 'ready', pileId: p1.id })
    .sys({ t: 'ready', pileId: p2.id })
    .acceptAt(p2.id, 1)
    .shortAt(p1.id, 2, 37_000);
  for (const e of b.build()) await mockEventStore.append(e);
  mockParams = { pile: p1.id };
  return { farm, p1, p2, red };
}

function render(saleId: string) {
  wrap(
    <SpeechProvider initial={false}>
      <SaleProvider saleId={saleId}>
        <CounterScreen />
      </SaleProvider>
    </SpeechProvider>,
  );
}

describe('E04-S05 — recorder mode at a weighing point', () => {
  it('shows the six values: point + tapper, current number, done, kg, open short basket', async () => {
    const { p1 } = await setup('sale-rec-1', null);
    render('sale-rec-1');
    await flush();
    await flush();
    expect(screen.getByTestId('rec-point')).toHaveTextContent(new RegExp(`จันทเขลม · ${p1.name}`));
    expect(screen.getByTestId('rec-tapper')).toHaveTextContent(/แดง/);
    // Basket 2 is a short one still open (E04-S06): it stays the current basket.
    expect(screen.getByTestId('rec-current')).toHaveTextContent('2');
    expect(screen.getByTestId('rec-totals-of')).toHaveTextContent('ยอดของแดง');
    expect(screen.getByTestId('rec-card-1')).toHaveTextContent(/เสร็จแล้ว\s*1\s*เข่ง/);
    expect(screen.getByTestId('rec-card-kg')).toHaveTextContent(/85\s*กก\./);
    // The open short basket (E04-S06): what is missing on the card, what it holds on its own card.
    expect(screen.getByTestId('rec-card-short')).toHaveTextContent(/เข่งไม่เต็ม 2.*เหลือเติม.*15\s*กก\./);
    expect(screen.getByTestId('rec-open')).toHaveTextContent(/35 กก\./);
    // The hold area has words only, never the number (D-40); here it says basket 2 waits.
    expect(screen.getByTestId('hold-label')).toHaveTextContent('เข่ง 2 รอเติม');
    expect(screen.queryByTestId('count')).toBeNull();
    expect(screen.getByTestId('rec-sync')).toHaveTextContent(/รอส่ง \d+/);
  });

  it('with a price, the first card is the compact total and the big card says how many are done (D-40, D-41)', async () => {
    await setup('sale-rec-2', 4_850);
    render('sale-rec-2');
    await flush();
    await flush();
    // 85 kg × 48.50 = 4,122.50 ฿
    expect(screen.getByTestId('rec-card-1')).toHaveTextContent(/ราคารวม\s*4.12 พัน/);
    expect(screen.getByTestId('rec-counted')).toHaveTextContent('นับแล้ว 1 เข่ง');
  });

  it('the ⋯ menu holds the basket list and "ชั่งครบแล้ว → ตรวจยอด"; the big number stays in view', async () => {
    const { p2 } = await setup('sale-rec-3', null);
    render('sale-rec-3');
    await flush();
    await flush();
    fireEvent.press(screen.getByTestId('rec-menu'));
    fireEvent.press(screen.getByTestId('rec-menu-list'));
    expect(screen.getByTestId('rec-list')).toHaveTextContent(new RegExp(`#1.*${p2.name}.*50 กก\\.`));
    expect(screen.getByTestId('rec-current')).toHaveTextContent('2');
    fireEvent.press(screen.getByTestId('rec-list-close'));
    fireEvent.press(screen.getByTestId('rec-menu'));
    fireEvent.press(screen.getByTestId('rec-menu-finish'));
    expect(screen.getByTestId('close-sale-detail')).toBeTruthy();
  });

  it('switching point is one tap to the point picker, which then opens the counter on the pick', async () => {
    await setup('sale-rec-4', null);
    render('sale-rec-4');
    await flush();
    await flush();
    fireEvent.press(screen.getByTestId('rec-switch'));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/sale/[id]/points', params: expect.objectContaining({ id: 'sale-rec-4', switch: '1' }) }),
    );
  });
});

describe('E04-S09 — undo, edit and void from the recorder', () => {
  async function open(saleId: string) {
    const ids = await setup(saleId, null);
    render(saleId);
    await flush();
    await flush();
    return ids;
  }

  it('undo asks once, takes the last basket off, and its number comes back', async () => {
    await open('sale-s09-1');
    fireEvent.press(screen.getByTestId('rec-undo'));
    expect(screen.getByTestId('undo-confirm-detail')).toHaveTextContent(/2/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('undo-confirm'));
    });
    await flush();
    expect(screen.getByTestId('rec-current')).toHaveTextContent('2');
    expect(screen.getByTestId('rec-card-kg')).toHaveTextContent(/50\s*กก\./);
  });

  it('edit a basket weight from the list: totals follow, the row says แก้แล้ว', async () => {
    await open('sale-s09-2');
    fireEvent.press(screen.getByTestId('rec-menu'));
    fireEvent.press(screen.getByTestId('rec-menu-list'));
    fireEvent.press(screen.getByTestId('rec-row-1'));
    fireEvent.changeText(screen.getByTestId('edit-kg'), '48.5');
    await act(async () => {
      fireEvent.press(screen.getByTestId('edit-save'));
    });
    await flush();
    expect(screen.getByTestId('rec-row-1')).toHaveTextContent(/48.5 กก\..*แก้แล้ว/);
    expect(screen.getByTestId('rec-card-kg')).toHaveTextContent(/83.5\s*กก\./);
  });

  it('move a basket to another point keeps its number', async () => {
    const { p1, p2 } = await open('sale-s09-3');
    fireEvent.press(screen.getByTestId('rec-menu'));
    fireEvent.press(screen.getByTestId('rec-menu-list'));
    fireEvent.press(screen.getByTestId('rec-row-1'));
    fireEvent.press(screen.getByTestId(`edit-point-${p1.id}`));
    await act(async () => {
      fireEvent.press(screen.getByTestId('edit-save'));
    });
    await flush();
    expect(screen.getByTestId('rec-row-1')).toHaveTextContent(new RegExp(p1.name));
    expect(screen.getByTestId('rec-row-1')).not.toHaveTextContent(new RegExp(p2.name));
  });

  it('void a basket: it stays in the list struck through ✗, totals drop, numbers keep their gap', async () => {
    await open('sale-s09-4');
    fireEvent.press(screen.getByTestId('rec-menu'));
    fireEvent.press(screen.getByTestId('rec-menu-list'));
    fireEvent.press(screen.getByTestId('rec-row-1'));
    fireEvent.press(screen.getByTestId('edit-void'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('edit-void-confirm'));
    });
    await flush();
    expect(screen.getByTestId('rec-row-1')).toHaveTextContent(/✗/);
    expect(screen.getByTestId('rec-card-1')).toHaveTextContent(/0\s*เข่ง/);
    expect(screen.getByTestId('rec-current')).toHaveTextContent('2');
  });
});

describe('E04-S11 — sale status on the recorder', () => {
  async function open(saleId: string, price: number | null) {
    const ids = await setup(saleId, price);
    render(saleId);
    await flush();
    await flush();
    return ids;
  }
  const status = async (saleId: string) =>
    ((await mockEventStore.load(saleId)) as { kind: string; payload?: { t: string } & Record<string, unknown> }[])
      .filter((e) => e.kind === 'sys' && (e.payload?.t === 'sale_status_set' || e.payload?.t === 'money_edit'))
      .map((e) => e.payload);

  it('completing needs a price: without one the menu item is off and says why', async () => {
    await open('sale-s11-1', null);
    expect(screen.getByTestId('rec-status')).toHaveTextContent('ร่าง');
    fireEvent.press(screen.getByTestId('rec-menu'));
    expect(screen.getByTestId('rec-menu-complete').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('rec-menu-sheet')).toHaveTextContent(/ใส่ราคาก่อน/);
  });

  it('completed: holds stop; an edit that changes money asks for a reason and flags it', async () => {
    await open('sale-s11-2', 4_850);
    fireEvent.press(screen.getByTestId('rec-menu'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('rec-menu-complete'));
    });
    await flush();
    expect(screen.getByTestId('rec-status')).toHaveTextContent('เสร็จสิ้น');
    expect(screen.getByTestId('rec-short').props.accessibilityState).toMatchObject({ disabled: true });

    fireEvent.press(screen.getByTestId('rec-menu'));
    fireEvent.press(screen.getByTestId('rec-menu-list'));
    fireEvent.press(screen.getByTestId('rec-row-1'));
    fireEvent.changeText(screen.getByTestId('edit-kg'), '45');
    fireEvent.press(screen.getByTestId('edit-save'));
    // No reason yet: nothing is written.
    expect(screen.getByTestId('money-reason')).toBeTruthy();
    fireEvent.press(screen.getByTestId('reason-confirm'));
    expect(screen.getByText('เลือกหรือพิมพ์เหตุผล')).toBeTruthy();
    fireEvent.press(screen.getByTestId('reason-0'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('reason-confirm'));
    });
    await flush();
    expect(screen.getByTestId('rec-card-kg')).toHaveTextContent(/80\s*กก\./);
    expect(await status('sale-s11-2')).toMatchObject([{ t: 'sale_status_set', status: 'completed' }, { t: 'money_edit', reason: 'ชั่งผิด' }]);
  });

  it('a typed reason (อื่นๆ) works for an undo after completed', async () => {
    await open('sale-s11-3', 4_850);
    fireEvent.press(screen.getByTestId('rec-menu'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('rec-menu-complete'));
    });
    await flush();
    fireEvent.press(screen.getByTestId('rec-undo'));
    fireEvent.press(screen.getByTestId('undo-confirm'));
    fireEvent.press(screen.getByTestId('reason-other'));
    fireEvent.changeText(screen.getByTestId('reason-text'), 'คนกรีดแจ้ง');
    await act(async () => {
      fireEvent.press(screen.getByTestId('reason-confirm'));
    });
    await flush();
    expect(screen.getByTestId('rec-current')).toHaveTextContent('2');
    expect((await status('sale-s11-3')).at(-1)).toMatchObject({ t: 'money_edit', reason: 'คนกรีดแจ้ง' });
  });

  async function complete() {
    fireEvent.press(screen.getByTestId('rec-menu'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('rec-menu-complete'));
    });
    await flush();
  }

  it('completed: a void asks why, and the flag comes before the void in the log (review S4)', async () => {
    await open('sale-s11-5', 4_850);
    await complete();
    fireEvent.press(screen.getByTestId('rec-menu'));
    fireEvent.press(screen.getByTestId('rec-menu-list'));
    fireEvent.press(screen.getByTestId('rec-row-1'));
    fireEvent.press(screen.getByTestId('edit-void'));
    fireEvent.press(screen.getByTestId('edit-void-confirm'));
    fireEvent.press(screen.getByTestId('reason-2'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('reason-confirm'));
    });
    await flush();
    const log = (await mockEventStore.load('sale-s11-5')) as { kind: string; seq: number; payload?: { t: string } }[];
    const flag = log.find((e) => e.kind === 'sys' && e.payload?.t === 'money_edit')!;
    const voided = log.find((e) => e.kind === 'correction')!;
    expect(flag.seq).toBeLessThan(voided.seq);
    expect(screen.getByTestId('rec-card-1')).toHaveTextContent(/ราคารวม/);
  });

  it('completed: saving an edit that changes nothing asks nothing and writes nothing (review S4)', async () => {
    await open('sale-s11-6', 4_850);
    await complete();
    const before = (await mockEventStore.load('sale-s11-6')).length;
    fireEvent.press(screen.getByTestId('rec-menu'));
    fireEvent.press(screen.getByTestId('rec-menu-list'));
    fireEvent.press(screen.getByTestId('rec-row-1'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('edit-save'));
    });
    await flush();
    expect(screen.queryByTestId('money-reason')).toBeNull();
    expect((await mockEventStore.load('sale-s11-6')).length).toBe(before);
  });

  it('completed: public mode takes no new basket, short or undo either (review S1)', async () => {
    await open('sale-s11-7', 4_850);
    await complete();
    fireEvent.press(screen.getByTestId('rec-public'));
    expect(screen.getByTestId('short').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('undo').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('a draft sale edits without asking; cancel asks once and is not a delete', async () => {
    await open('sale-s11-4', null);
    fireEvent.press(screen.getByTestId('rec-menu'));
    fireEvent.press(screen.getByTestId('rec-menu-list'));
    fireEvent.press(screen.getByTestId('rec-row-1'));
    fireEvent.changeText(screen.getByTestId('edit-kg'), '45');
    await act(async () => {
      fireEvent.press(screen.getByTestId('edit-save'));
    });
    await flush();
    expect(screen.queryByTestId('money-reason')).toBeNull();
    fireEvent.press(screen.getByTestId('rec-list-close'));
    fireEvent.press(screen.getByTestId('rec-menu'));
    fireEvent.press(screen.getByTestId('rec-menu-cancel'));
    expect(screen.getByTestId('cancel-sale-body')).toHaveTextContent(/ไม่นับในยอด/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('cancel-sale-confirm'));
    });
    await flush();
    expect(screen.getByTestId('rec-status')).toHaveTextContent('ยกเลิกแล้ว');
    expect(await status('sale-s11-4')).toMatchObject([{ t: 'sale_status_set', status: 'cancelled' }]);
  });
});

describe('E04-S06 — open short baskets and bridging on the recorder', () => {
  /** แดง: จุด A, จุด B; นัด: จุด C. แดง's basket 1 is short (35 kg) and open at จุด A. */
  async function bridge(saleId: string, at: 'A' | 'B' | 'C') {
    await mockMaster.updateSettings({ zeroCheck: 'skip' });
    const farm = await mockMaster.addProperty({ name: `สวน ${saleId}`, crop: 'rubber' });
    const A = await mockMaster.addPoint(farm.id, 'จุด A');
    const B = await mockMaster.addPoint(farm.id, 'จุด B');
    const C = await mockMaster.addPoint(farm.id, 'จุด C');
    const red = await mockMaster.create('แดง', ['tapper']);
    const nat = await mockMaster.create('นัด', ['tapper']);
    await mockMaster.assignTapper(A.id, red.id, null);
    await mockMaster.assignTapper(B.id, red.id, null);
    await mockMaster.assignTapper(C.id, nat.id, null);
    const b = new LogBuilder(saleId)
      .sys({ t: 'sale_started', farmName: '', buyer: 'ล้ง', manager: '', workerLead: '', where: 'farm' })
      .sys({ t: 'numbering_set', numbering: 'per-tapper' })
      .sys({ t: 'zone_added', zoneId: farm.id, name: farm.name });
    for (const p of [A, B, C]) {
      b.sys({ t: 'pile_added', pileId: p.id, zoneId: farm.id, name: p.name, tareG: 2_000, stdNetG: 50_000 }).sys({ t: 'ready', pileId: p.id });
    }
    b.shortAt(A.id, 1, 37_000);
    for (const e of b.build()) await mockEventStore.append(e);
    mockParams = { pile: { A, B, C }[at].id };
    render(saleId);
    await flush();
    await flush();
    return { A, B, C, rootId: b.build().at(-1)!.id };
  }
  const log = async (saleId: string) =>
    (await mockEventStore.load(saleId)) as { kind: string; payload?: { t: string } & Record<string, unknown> }[];

  it('at its own point: the open card, "รอเติม", and "จบเข่งนี้" closes it as a short basket', async () => {
    const { rootId } = await bridge('sale-s06-1', 'A');
    expect(screen.getByTestId('rec-current')).toHaveTextContent('1');
    expect(screen.getByTestId('rec-card-short')).toHaveTextContent(/เข่งไม่เต็ม 1.*เหลือเติม.*15\s*กก\./);
    expect(screen.getByTestId('rec-open')).toHaveTextContent(/เข่ง 1 เปิดอยู่ · 35 กก\..*ตาชั่ง 37 - น้ำหนักเข่ง 2/);
    expect(screen.getByTestId('hold-label')).toHaveTextContent(/เข่ง 1 รอเติม/);
    // It cannot be undone, so it asks once (review fix).
    fireEvent.press(screen.getByTestId('rec-close-basket'));
    expect((await log('sale-s06-1')).filter((e) => e.payload?.t === 'basket_closed')).toEqual([]);
    await act(async () => {
      fireEvent.press(screen.getByTestId('rec-close-basket-yes'));
    });
    await flush();
    expect((await log('sale-s06-1')).filter((e) => e.payload?.t === 'basket_closed')).toMatchObject([{ payload: { basketId: rootId, reason: 'scrap' } }]);
    expect(screen.getByTestId('rec-current')).toHaveTextContent('2');
  });

  it("at the tapper's next point: three ways, with what the scale should read (D-42, D-57)", async () => {
    await bridge('sale-s06-2', 'B');
    const sheet = screen.getByTestId('fill-sheet');
    expect(sheet).toHaveTextContent(/เข่ง 1 ยังไม่เต็ม/);
    expect(screen.getByTestId('fill-full')).toHaveTextContent(/เติมอีก 15 กก\. เป็นเข่ง 1.*ตาชั่งอ่าน 52 กก\. ทั้งเข่ง/);
    expect(screen.getByTestId('fill-part')).toHaveTextContent(/ชั่งส่วนที่เติม 15 กก\..*ตาชั่งอ่าน 17 กก\./);
    expect(screen.getByTestId('fill-next')).toHaveTextContent(/เข่ง 1 ไม่เต็ม 35 กก\..*เข่งเต็มถัดไปคือ เข่ง 2/);
    fireEvent.press(screen.getByTestId('fill-full'));
    expect(screen.queryByTestId('fill-sheet')).toBeNull();
    expect(screen.getByTestId('hold-label')).toHaveTextContent(/เติมเข่ง 1.*เติมอีก 15 กก\./);
    expect(screen.getByTestId('caption')).toHaveTextContent(/ตาชั่งควรอ่าน 52 กก\./);
    expect(screen.getByTestId('rec-short')).toHaveTextContent(/เติมไม่ถึง/);
  });

  it('"ปล่อยเข่งไม่เต็มไว้" closes basket 1 short and the next full basket is 2', async () => {
    const { rootId } = await bridge('sale-s06-3', 'B');
    await act(async () => {
      fireEvent.press(screen.getByTestId('fill-next'));
    });
    await flush();
    expect((await log('sale-s06-3')).filter((e) => e.payload?.t === 'basket_closed')).toMatchObject([{ payload: { basketId: rootId, reason: 'next' } }]);
    expect(screen.getByTestId('rec-current')).toHaveTextContent('2');
  });

  it('closing the sheet puts the choice off: nothing is written, nothing is weighed, and it can be chosen again (review fix)', async () => {
    await bridge('sale-s06-5', 'B');
    const before = (await log('sale-s06-5')).length;
    fireEvent.press(screen.getByLabelText('ปิด'));
    expect(screen.queryByTestId('fill-sheet')).toBeNull();
    expect(screen.getByTestId('rec-short').props.accessibilityState).toMatchObject({ disabled: true });
    expect((await log('sale-s06-5')).length).toBe(before);
    fireEvent.press(screen.getByTestId('rec-fill-choose'));
    expect(screen.getByTestId('fill-sheet')).toBeTruthy();
  });

  it('public mode waits too: with the basket open here, no hold and no short basket (review fix)', async () => {
    await bridge('sale-s06-6', 'A');
    fireEvent.press(screen.getByTestId('rec-public'));
    expect(screen.getByTestId('short').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it("another tapper's point closes it short without asking (SALE-12)", async () => {
    const { rootId } = await bridge('sale-s06-4', 'C');
    await flush();
    expect(screen.queryByTestId('fill-sheet')).toBeNull();
    expect((await log('sale-s06-4')).filter((e) => e.payload?.t === 'basket_closed')).toMatchObject([{ payload: { basketId: rootId, reason: 'tapper-change' } }]);
  });
});
