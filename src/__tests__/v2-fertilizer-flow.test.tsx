import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { projectDebts } from '../core/finance/debts';
import { fertOptionId, projectFinance } from '../core/finance/ledger';
import type { ExpenseFields, FinanceEvent } from '../core/finance/types';
import { FertilizerFlowScreen } from '../v2/money/fertilizer-flow';
import { FertilizerSettingsScreen } from '../v2/money/fertilizer-settings';
import { financeStore as mockFinance } from '../store/finance';
import { peopleStore as mockPeople } from '../store/people';
import { wrap } from '../test/render';

jest.mock('../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
});
jest.mock('../store/people', () => {
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { peopleStore: new MemoryPeopleStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('expo-router', () => {
  const params: { current: Record<string, string> } = { current: {} };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => params.current,
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
    router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false },
    __params: params,
  };
});
const { __params: mockParams, router: mockRouter } = jest.requireMock('expo-router') as {
  __params: { current: Record<string, string> };
  router: { push: jest.Mock; replace: jest.Mock };
};

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

let seq = 0;
async function seed(targetId: string, payload: FinanceEvent['payload'], base: string | null = null) {
  seq += 1;
  const id = `seed-${String(seq).padStart(3, '0')}`;
  await mockFinance.append({ id, groupId: 'group-1', deviceSeq: seq, ts: seq, actor: { userId: 'u', deviceId: 'dev-other' }, source: 'app', targetId, baseEventId: base, payload });
  return id;
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const type = (id: string, v: string) => fireEvent.changeText(screen.getByTestId(id), v);
const next = () => press('fert-next');

let daeng = '';
let nat = '';
let farm = '';
let zA = '';
let zB = '';
const YELLOW = fertOptionId('reason', 'ใบเหลือง');

beforeAll(async () => {
  daeng = (await mockPeople.create('แดง', ['tapper'])).id;
  nat = (await mockPeople.create('นัด', ['tapper'])).id;
  farm = (await mockPeople.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' })).id;
  zA = (await mockPeople.addZone(farm, 'โซนริมคลอง', '2026-10-01')).id;
  zB = (await mockPeople.addZone(farm, 'โซนหลังบ้าน', '2026-10-01')).id;
  await seed(YELLOW, { t: 'fert_option_set', kind: 'reason', name: 'ใบเหลือง', description: 'ใบเหลืองทั้งแปลง เริ่มจากใบล่างแล้วลามขึ้น มักเห็นหลังฝนตกชุก', hidden: false });
});

/** Step 1 with 10 sacks of 15-15-15 at 10,000.00, discount 500.00 unless told otherwise. */
async function buy({ bill = '10000', discount = '500', sacks = '10' } = {}) {
  press('fert-product');
  await flush();
  type('fert-formula', '15-15-15');
  type('fert-sackKg', '50');
  press('fert-product-done');
  await flush();
  type('fert-sacks', sacks);
  type('fert-bill', bill);
  if (discount) {
    press('fert-discount-switch');
    type('fert-discount', discount);
  }
}

async function created(): Promise<FinanceEvent[]> {
  return (await mockFinance.load()).filter((e) => e.payload.t === 'expense_created');
}

describe('fertilizer purchase flow (E11-S10 C)', () => {
  beforeEach(() => {
    mockParams.current = { bill: '10000', date: '2026-10-14' };
    mockRouter.push.mockClear();
  });

  it('golden path: 6 steps, one expense with share + details, the debt projected, no debt_added', async () => {
    const before = (await created()).length;
    wrap(<FertilizerFlowScreen />);
    await flush();
    expect(screen.getByText('ขั้น 1/6 · ซื้ออะไร')).toBeTruthy();
    // What was typed in the expense form comes along.
    expect(screen.getByTestId('fert-bill').props.value).toBe('10000');

    press('fert-product');
    await flush();
    type('fert-formula', '15-15-15');
    press('fert-add-formula');
    expect(screen.getByTestId('fert-remember-formula').props.accessibilityState).toMatchObject({ checked: true });
    type('fert-brand', 'ตราใบไม้ทอง');
    type('fert-sackKg', '50');
    press('fert-product-done');
    await flush();
    expect(screen.getByTestId('fert-product')).toHaveTextContent(/15-15-15 · ตราใบไม้ทอง/);

    press('fert-sacks-more');
    type('fert-sacks', '10');
    // Discount is a switch, off until wanted.
    expect(screen.queryByTestId('fert-discount')).toBeNull();
    press('fert-discount-switch');
    type('fert-discount', '500');
    expect(screen.getByTestId('fert-net')).toHaveTextContent(/9,500\.00/);
    expect(screen.getByTestId('fert-net')).toHaveTextContent(/950\.00/);
    next();
    await flush();

    // 2 — reasons: a saved one, and a new one saved for reuse.
    expect(screen.getByText('ขั้น 2/6 · ทำไมถึงใส่')).toBeTruthy();
    expect(screen.getByTestId('fert-step-buy')).toHaveTextContent('✓ ซื้อ');
    press(`fert-reason-${YELLOW}`);
    type('fert-reason-search', 'บำรุงต้น');
    type('fert-reason-desc', 'ใส่ตามรอบ ให้ต้นแข็งแรง');
    press('fert-remember-reason');
    await act(async () => press('fert-reason-add'));
    await flush();
    // The search clears once the reason is added.
    expect(screen.getByTestId('fert-reason-search').props.value).toBe('');
    expect(screen.getByText('เลือกแล้ว 2 · เลือกได้หลายข้อ')).toBeTruthy();
    next();
    await flush();

    // 3 — date from the form, payer defaults to farm funds the first time.
    expect(screen.getByTestId('fert-date').props.value).toBe('2026-10-14');
    expect(screen.getByTestId('fert-payer-farm').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('fert-receipt')).toHaveTextContent(/เร็ว ๆ นี้/);
    type('fert-shop', 'ร้านเกษตรรุ่งเรือง');
    next();
    await flush();

    // 4 — zones of the one farm.
    press(`fert-farm-${farm}`);
    type(`fert-zone-${zA}-sacks`, '6');
    press(`fert-zone-${zA}-reason-${YELLOW}`);
    type(`fert-zone-${zA}-note`, 'ใบเหลืองแถวติดน้ำ');
    type(`fert-zone-${zB}-sacks`, '5');
    expect(screen.getByTestId('fert-zones-err')).toBeTruthy();
    type(`fert-zone-${zB}-sacks`, '4');
    expect(screen.getByTestId('fert-zones-sum')).toHaveTextContent(/10 \/ 10 กระสอบ/);
    next();
    await flush();

    // 5 — แดง 6 on debt; นัด picked last gets the rest, and pays.
    press(`fert-pick-${daeng}`);
    type(`fert-line-${daeng}-sacks`, '6');
    press(`fert-pick-${nat}`);
    expect(screen.getByTestId(`fert-line-${nat}-sacks`).props.value).toBe('4');
    expect(screen.getByTestId(`fert-line-${nat}-auto`)).toBeTruthy();
    expect(screen.getByTestId(`fert-line-${daeng}-pct`).props.value).toBe('50');
    expect(screen.getByTestId(`fert-line-${daeng}-cost`)).toHaveTextContent(/5,700\.00.*2,850\.00/);
    press(`fert-line-${nat}-settle-paid`);
    expect(screen.getByTestId('fert-split-head')).toHaveTextContent(/แบ่งแล้ว 10\/10 · เหลือ 0/);
    next();
    await flush();

    // 6 — summary, then save in the header.
    expect(screen.getByTestId('fert-sum-head')).toHaveTextContent(/9,500\.00/);
    expect(screen.getByTestId('fert-sum-split')).toHaveTextContent(/4,750\.00/);
    expect(screen.getByTestId('fert-sum-total')).toHaveTextContent(/9,500\.00.*ตรง/);
    press('fert-sum-zones');
    expect(screen.getByTestId('fert-detail-sheet')).toHaveTextContent(/โซนริมคลอง · 6 กระสอบ/);
    await act(async () => press('fert-save'));
    await flush();

    const events = await mockFinance.load();
    expect(events.some((e) => e.payload.t === 'debt_added')).toBe(false);
    const made = await created();
    expect(made).toHaveLength(before + 1);
    const fields = (made[made.length - 1].payload as { fields: ExpenseFields }).fields;
    expect(fields).toMatchObject({
      amountSatang: 950_000,
      date: '2026-10-14',
      stage: 'actual',
      categoryId: 'cat-fertilizer',
      propertyId: farm,
      share: { billSatang: 1_000_000, discountSatang: 50_000, totalSacks: 10 },
      fertilizer: { type: 'chemical', formula: '15-15-15', brand: 'ตราใบไม้ทอง', sackKg: 50, shop: 'ร้านเกษตรรุ่งเรือง' },
    });
    expect(fields.share?.lines.map((l) => [l.worker.id, l.sacks, l.settle])).toEqual([
      [daeng, 6, 'debt'],
      [nat, 4, 'paid'],
    ]);
    expect(fields.fertilizer?.reasons).toEqual([YELLOW, fertOptionId('reason', 'บำรุงต้น')]);
    expect(fields.fertilizer?.zones).toEqual([
      { zoneId: zA, zoneName: 'โซนริมคลอง', sacks: 6, reasons: [YELLOW], note: 'ใบเหลืองแถวติดน้ำ' },
      { zoneId: zB, zoneName: 'โซนหลังบ้าน', sacks: 4, reasons: [], note: '' },
    ]);
    const options = projectFinance(events).fertOptions;
    expect(options.map((o) => o.id)).toEqual(expect.arrayContaining([fertOptionId('formula', '15-15-15'), fertOptionId('reason', 'บำรุงต้น')]));
    // Brand was typed but not saved for reuse.
    expect(options.some((o) => o.kind === 'brand')).toBe(false);
    expect(projectDebts(events).get(daeng)?.balanceSatang).toBe(285_000);
    expect(projectDebts(events).get(nat)?.balanceSatang ?? 0).toBe(0);
  });

  it('going back keeps what was entered; a reason typed once is not saved', async () => {
    wrap(<FertilizerFlowScreen />);
    await flush();
    await buy();
    next();
    await flush();
    type('fert-reason-search', 'ต้นโทรมหลังฝนชุก');
    await act(async () => press('fert-reason-add'));
    press('fert-back');
    await flush();
    expect(screen.getByTestId('fert-sacks').props.value).toBe('10');
    expect(screen.getByTestId('fert-discount').props.value).toBe('500');
    next();
    await flush();
    type('fert-reason-search', '');
    expect(screen.getByTestId('fert-reason-text:ต้นโทรมหลังฝนชุก')).toHaveTextContent(/ใช้ครั้งนี้ครั้งเดียว/);
    expect(projectFinance(await mockFinance.load()).fertOptions.some((o) => o.name === 'ต้นโทรมหลังฝนชุก')).toBe(false);
  });

  it('zones can be skipped; sacks left over go to stock at the farm’s cost', async () => {
    wrap(<FertilizerFlowScreen />);
    await flush();
    await buy({ discount: '' });
    next();
    next();
    await flush();
    next();
    await flush();
    press('fert-skip');
    await flush();
    press(`fert-pick-${daeng}`);
    type(`fert-line-${daeng}-sacks`, '6');
    expect(screen.getByTestId('fert-leftover')).toHaveTextContent(/เหลือ 4 กระสอบ.*4,000\.00/);
    next();
    await flush();
    // Owner, tappers and leftover each once, adding up to the net.
    expect(screen.getByTestId('fert-sum-owner')).toHaveTextContent(/3,000\.00/);
    expect(screen.getByTestId('fert-sum-tappers')).toHaveTextContent(/3,000\.00/);
    expect(screen.getByTestId('fert-sum-leftover')).toHaveTextContent(/4 กระสอบ.*4,000\.00/);
    expect(screen.getByTestId('fert-sum-total')).toHaveTextContent(/10,000\.00.*ตรง/);
    await act(async () => press('fert-save'));
    await flush();
    const made = await created();
    const fields = (made[made.length - 1].payload as { fields: ExpenseFields }).fields;
    expect(fields.fertilizer?.zones).toEqual([]);
    expect(fields.share).toMatchObject({ totalSacks: 10, lines: [{ sacks: 6 }] });
  });

  it('from add-debt: the tapper is preselected and given every sack; same one expense', async () => {
    mockParams.current = { workerId: nat, name: 'นัด' };
    const before = (await created()).length;
    wrap(<FertilizerFlowScreen />);
    await flush();
    await buy({ bill: '4000', discount: '' });
    for (let i = 0; i < 4; i++) {
      next();
      await flush();
    }
    expect(screen.getByTestId(`fert-line-${nat}-sacks`).props.value).toBe('10');
    next();
    await flush();
    await act(async () => press('fert-save'));
    await flush();
    const made = await created();
    expect(made).toHaveLength(before + 1);
    const fields = (made[made.length - 1].payload as { fields: ExpenseFields }).fields;
    expect(fields).toMatchObject({ amountSatang: 400_000, categoryId: 'cat-fertilizer', share: { lines: [{ worker: { id: nat }, sacks: 10, settle: 'debt' }] } });
    expect(projectDebts(await mockFinance.load()).get(nat)?.balanceSatang).toBe(200_000);
  });

  it('a farm with no zones offers "add zone"; the new zone is a card at once', async () => {
    const bare = (await mockPeople.addProperty({ name: 'สวนฝั่งคลองพลู', crop: 'rubber' })).id;
    wrap(<FertilizerFlowScreen />);
    await flush();
    await buy();
    for (let i = 0; i < 3; i++) {
      next();
      await flush();
    }
    press(`fert-farm-${bare}`);
    expect(screen.getByText('ยังไม่มีโซน')).toBeTruthy();
    press('fert-zone-add');
    type('fert-zone-name', 'โซนใหม่');
    await act(async () => press('fert-zone-save'));
    await flush();
    const z = (await mockPeople.state()).zones.find((x) => x.name === 'โซนใหม่');
    expect(z).toMatchObject({ propertyId: bare });
    expect(screen.getByTestId(`fert-zone-${z!.id}-sacks`)).toBeTruthy();
  });

  it('edit: prefilled from the expense; saving writes only what changed, on the head', async () => {
    const fields: ExpenseFields = {
      amountSatang: 300_000,
      date: '2026-10-01',
      stage: 'actual',
      categoryId: 'cat-fertilizer',
      propertyId: null,
      item: 'ยูเรีย',
      note: '',
      payer: { id: 'farm', name: 'เงินสวน' },
      share: { billSatang: 300_000, discountSatang: 0, totalSacks: 3, lines: [{ worker: { id: daeng, name: 'แดง' }, sacks: 3, workerPct: 50, settle: 'debt' }] },
      fertilizer: { type: 'chemical', formula: 'ยูเรีย', brand: '', sackKg: null, reasons: [], zones: [], shop: '', orderedBy: '' },
    };
    const head = await seed('exp-edit', { t: 'expense_created', fields });
    mockParams.current = { id: 'exp-edit' };
    wrap(<FertilizerFlowScreen />);
    await flush();
    expect(screen.getByText('แก้การซื้อปุ๋ย')).toBeTruthy();
    expect(screen.getByTestId('fert-bill').props.value).toBe('3000.00');
    type('fert-bill', '3300');
    press('fert-step-sum');
    await flush();
    await act(async () => press('fert-save'));
    await flush();
    const change = (await mockFinance.load()).find((e) => e.targetId === 'exp-edit' && e.payload.t === 'expense_changed');
    expect(change?.baseEventId).toBe(head);
    expect(Object.keys((change?.payload as { patch: object }).patch).sort()).toEqual(['amountSatang', 'share']);
  });
});

describe('fertilizer flow — review fixes (E11-S10)', () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
  });

  it('carries stage and payer from the expense form; a planned share says the debt comes when actual', async () => {
    mockParams.current = { bill: '1000', date: '2026-10-14', stage: 'planned', payerId: nat, payerName: 'นัด' };
    wrap(<FertilizerFlowScreen />);
    await flush();
    await buy({ bill: '1000', discount: '' });
    next();
    await flush();
    next();
    await flush();
    expect(screen.getByTestId('fert-stage-planned').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId(`fert-payer-${nat}`).props.accessibilityState).toMatchObject({ selected: true });
    next();
    await flush();
    next();
    await flush();
    press(`fert-pick-${daeng}`);
    expect(screen.getByTestId(`fert-line-${daeng}-hint`)).toHaveTextContent(/เกิดจริง/);
    expect(screen.getByTestId(`fert-line-${daeng}-hint`)).not.toHaveTextContent(/สรุปยอดขาย/);
    press('fert-pct-settings');
    expect(mockRouter.push).toHaveBeenCalledWith('/v2/fertilizer-settings');
    next();
    await flush();
    expect(screen.getByTestId(`fert-sum-line-${daeng}`)).toHaveTextContent(/เกิดจริง/);
  });

  const purchase = (over: Partial<ExpenseFields> = {}): ExpenseFields => ({
    amountSatang: 200_000,
    date: '2026-10-01',
    stage: 'actual',
    categoryId: 'cat-fertilizer',
    propertyId: null,
    item: 'ยูเรีย',
    note: '',
    payer: { id: 'farm', name: 'เงินสวน' },
    share: { billSatang: 200_000, discountSatang: 0, totalSacks: 2, lines: [{ worker: { id: daeng, name: 'แดง' }, sacks: 2, workerPct: 50, settle: 'debt' }] },
    fertilizer: { type: 'chemical', formula: 'ยูเรีย', brand: '', sackKg: null, reasons: [], zones: [], shop: '', orderedBy: '' },
    ...over,
  });
  const lastPatch = async (id: string) => {
    const evs = (await mockFinance.load()).filter((e) => e.targetId === id && e.payload.t === 'expense_changed');
    return (evs[evs.length - 1].payload as { patch: Record<string, unknown> }).patch;
  };

  it('edit: a share change writes the net amount with it; the item follows the formula', async () => {
    await seed('exp-r1', { t: 'expense_created', fields: purchase() });
    mockParams.current = { id: 'exp-r1' };
    wrap(<FertilizerFlowScreen />);
    await flush();
    press('fert-product');
    await flush();
    type('fert-formula', '46-0-0');
    press('fert-product-done');
    await flush();
    press('fert-step-tapper');
    type(`fert-line-${daeng}-pct`, '40');
    press('fert-step-sum');
    await act(async () => press('fert-save'));
    await flush();
    const patch = await lastPatch('exp-r1');
    expect(Object.keys(patch).sort()).toEqual(['amountSatang', 'fertilizer', 'item', 'share']);
    expect(patch.item).toBe('46-0-0');
    expect(patch.amountSatang).toBe(200_000);
  });

  it('the % for fertilizer is set in fertilizer settings, naming the head it saw', async () => {
    wrap(<FertilizerSettingsScreen />);
    await flush();
    type('fert-set-pct', '40');
    await act(async () => press('fert-set-pct-save'));
    await flush();
    type('fert-set-pct', '45');
    await act(async () => press('fert-set-pct-save'));
    await flush();
    const evs = (await mockFinance.load()).filter((e) => e.targetId === 'cat-fertilizer' && e.payload.t === 'category_share_set');
    expect(evs).toHaveLength(2);
    expect(evs[1].baseEventId).toBe(evs[0].id);
    expect(projectFinance(await mockFinance.load()).categories.find((c) => c.id === 'cat-fertilizer')?.workerPct).toBe(45);
  });

  it('a renamed option frees its old name; remembering a hidden one keeps its description', async () => {
    const oldId = fertOptionId('formula', '13-13-21');
    await seed(oldId, { t: 'fert_option_set', kind: 'formula', name: '13-13-21 ตราม้า', description: '', hidden: false });
    const burnt = fertOptionId('reason', 'ใบไหม้');
    await seed(burnt, { t: 'fert_option_set', kind: 'reason', name: 'ใบไหม้', description: 'ขอบใบไหม้', hidden: true });
    mockParams.current = { bill: '1000' };
    wrap(<FertilizerFlowScreen />);
    await flush();
    press('fert-product');
    await flush();
    type('fert-formula', '13-13-21');
    press('fert-add-formula');
    press('fert-product-done');
    await flush();
    type('fert-sacks', '1');
    next();
    await flush();
    type('fert-reason-search', 'ใบไหม้');
    press('fert-remember-reason');
    await act(async () => press('fert-reason-add'));
    await flush();
    const options = projectFinance(await mockFinance.load()).fertOptions;
    expect(options.find((o) => o.id === oldId)?.name).toBe('13-13-21 ตราม้า');
    expect(options.filter((o) => o.kind === 'formula' && o.name === '13-13-21')).toHaveLength(1);
    expect(options.find((o) => o.id === burnt)).toMatchObject({ hidden: false, description: 'ขอบใบไหม้' });
  });
});

describe('fertilizer settings (21h)', () => {
  it('adds a reason with a description, renames it on the same record, hides and shows it', async () => {
    wrap(<FertilizerSettingsScreen />);
    await flush();
    press('fert-set-add');
    type('fert-set-name', 'เร่งน้ำยาง');
    type('fert-set-desc', 'ช่วงก่อนเปิดกรีด');
    await act(async () => press('fert-set-save'));
    await flush();
    const id = fertOptionId('reason', 'เร่งน้ำยาง');
    expect(screen.getByTestId(`fert-set-row-${id}`)).toHaveTextContent(/ช่วงก่อนเปิดกรีด/);

    press(`fert-set-edit-${id}`);
    type('fert-set-name', 'เร่งน้ำยางก่อนเปิดกรีด');
    await act(async () => press('fert-set-save'));
    await flush();
    press(`fert-set-hide-${id}`);
    await flush();
    expect(screen.getByTestId(`fert-set-row-${id}`)).toHaveTextContent(/ซ่อนอยู่/);

    const events = (await mockFinance.load()).filter((e) => e.targetId === id);
    expect(events).toHaveLength(3);
    expect(events[1].baseEventId).toBe(events[0].id);
    expect(events[2].baseEventId).toBe(events[1].id);
    expect(projectFinance(await mockFinance.load()).fertOptions.find((o) => o.id === id)).toMatchObject({ name: 'เร่งน้ำยางก่อนเปิดกรีด', hidden: true });

    press(`fert-set-hide-${id}`);
    await flush();
    expect(projectFinance(await mockFinance.load()).fertOptions.find((o) => o.id === id)?.hidden).toBe(false);
  });

  it('tabs list each kind; search narrows', async () => {
    await seed(fertOptionId('brand', 'ตราใบไม้'), { t: 'fert_option_set', kind: 'brand', name: 'ตราใบไม้', description: '', hidden: false });
    wrap(<FertilizerSettingsScreen />);
    await flush();
    press('fert-set-tab-brand');
    expect(screen.getByText('ตราใบไม้')).toBeTruthy();
    expect(screen.queryByText('ใบเหลือง')).toBeNull();
    press('fert-set-tab-reason');
    type('fert-set-search', 'เหลือง');
    expect(screen.getByText('ใบเหลือง')).toBeTruthy();
    expect(screen.queryByText('บำรุงต้น')).toBeNull();
  });
});
