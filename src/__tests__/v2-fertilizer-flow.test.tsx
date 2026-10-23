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
const prev = () => press('fert-prev');

let daeng = '';
let nat = '';
let farm = '';
let zA = '';
let zB = '';
const YELLOW = fertOptionId('reason', 'ใบเหลือง');
const PRODUCT = 'chemical|15-15-15|ตราใบไม้ทอง|50';

beforeAll(async () => {
  daeng = (await mockPeople.create('แดง', ['tapper'])).id;
  nat = (await mockPeople.create('นัด', ['tapper'])).id;
  farm = (await mockPeople.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' })).id;
  zA = (await mockPeople.addZone(farm, 'โซนริมคลอง', '2026-10-01')).id;
  zB = (await mockPeople.addZone(farm, 'โซนหลังบ้าน', '2026-10-01')).id;
  await seed(YELLOW, { t: 'fert_option_set', kind: 'reason', name: 'ใบเหลือง', description: 'ใบเหลืองทั้งแปลง เริ่มจากใบล่างแล้วลามขึ้น มักเห็นหลังฝนตกชุก', hidden: false });
});

/** F1 + F2: a new 15-15-15 (once only unless `remember`), 10 sacks at 10,000.00, discount 500.00 unless told otherwise. */
async function buy({ bill = '10000', discount = '500', sacks = '10', remember = false } = {}) {
  press('fert-new');
  await flush();
  type('fert-formula', '15-15-15');
  press('fert-kg-50');
  if (!remember) press('fert-remember');
  await act(async () => press('fert-new-done'));
  await flush();
  next();
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
const lastFields = async () => {
  const made = await created();
  return (made[made.length - 1].payload as { fields: ExpenseFields }).fields;
};

describe('fertilizer purchase flow — simple design (E11-S10, approved 2026-10-23)', () => {
  beforeEach(() => {
    mockParams.current = { bill: '10000', date: '2026-10-14' };
    mockRouter.push.mockClear();
  });

  it('golden path: one question per step, one expense with share + details, the debt projected, no debt_added', async () => {
    const before = (await created()).length;
    wrap(<FertilizerFlowScreen />);
    await flush();
    // F1 — nothing bought yet: only "ปุ๋ยใหม่"; one tick saves formula, brand and size.
    expect(screen.getByTestId('fert-progress')).toHaveTextContent('1 จาก 6');
    expect(screen.getByTestId('fert-question')).toHaveTextContent('ซื้อปุ๋ยอะไร');
    expect(screen.queryByTestId('fert-prev')).toBeNull();
    press('fert-new');
    await flush();
    expect(screen.getByTestId('fert-remember').props.accessibilityState).toMatchObject({ checked: true });
    type('fert-formula', '15-15-15');
    type('fert-brand', 'ตราใบไม้ทอง');
    press('fert-kg-50');
    await act(async () => press('fert-new-done'));
    await flush();
    expect(screen.getByTestId('fert-picked')).toHaveTextContent(/15-15-15 · ตราใบไม้ทอง/);
    next();
    await flush();

    // F2 — the bill came from the expense form.
    expect(screen.getByTestId('fert-progress')).toHaveTextContent('2 จาก 6');
    expect(screen.getByTestId('fert-bill').props.value).toBe('10000');
    press('fert-sacks-more');
    type('fert-sacks', '10');
    expect(screen.queryByTestId('fert-discount')).toBeNull();
    press('fert-discount-switch');
    type('fert-discount', '500');
    expect(screen.getByTestId('fert-net')).toHaveTextContent(/9,500\.00/);
    expect(screen.getByTestId('fert-net')).toHaveTextContent(/950\.00/);
    next();
    await flush();

    // F3 — a saved reason, and a new one remembered (the tick starts on).
    expect(screen.getByTestId('fert-question')).toHaveTextContent('ใส่ทำไม');
    press(`fert-reason-${YELLOW}`);
    press('fert-reason-new');
    await flush();
    type('fert-reason-name', 'บำรุงต้น');
    type('fert-reason-desc', 'ใส่ตามรอบ ให้ต้นแข็งแรง');
    await act(async () => press('fert-reason-add'));
    await flush();
    expect(screen.getByTestId(`fert-reason-${fertOptionId('reason', 'บำรุงต้น')}`).props.accessibilityState).toMatchObject({ checked: true });
    next();
    await flush();

    // F4 — farm funds the first time; date and shop behind "เพิ่มรายละเอียด".
    expect(screen.getByTestId('fert-question')).toHaveTextContent('ใครจ่ายเงินไปก่อน');
    expect(screen.getByTestId('fert-payer-farm').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('fert-details')).toHaveTextContent(/14 ต\.ค\. 2569 · ซื้อแล้ว/);
    press('fert-details');
    await flush();
    expect(screen.getByTestId('fert-date').props.value).toBe('2026-10-14');
    expect(screen.getByTestId('fert-stage-actual')).toHaveTextContent('ซื้อแล้ว');
    expect(screen.getByTestId('fert-receipt')).toHaveTextContent(/เร็ว ๆ นี้/);
    type('fert-shop', 'ร้านเกษตรรุ่งเรือง');
    press('fert-details-done');
    await flush();
    next();
    await flush();

    // F5 — แดง 6 on debt; นัด picked last gets the rest, and pays.
    expect(screen.getByTestId('fert-question')).toHaveTextContent('แบ่งให้ใคร');
    press('fert-add-tapper');
    await flush();
    press(`fert-pick-${daeng}`);
    await flush();
    type(`fert-line-${daeng}-sacks`, '6');
    press('fert-add-tapper');
    await flush();
    press(`fert-pick-${nat}`);
    await flush();
    expect(screen.getByTestId(`fert-line-${nat}-sacks`).props.value).toBe('4');
    expect(screen.getByTestId(`fert-line-${nat}-auto`)).toBeTruthy();
    expect(screen.getByTestId(`fert-line-${daeng}-pct`)).toHaveTextContent('50%');
    expect(screen.getByTestId(`fert-line-${daeng}-cost`)).toHaveTextContent(/5,700\.00/);
    expect(screen.getByTestId(`fert-line-${daeng}-part`)).toHaveTextContent(/2,850\.00/);
    press(`fert-line-${nat}-settle-paid`);
    expect(screen.getByTestId('fert-split-head')).toHaveTextContent(/แบ่งครบ 10 \/ 10 กระสอบ/);
    next();
    await flush();

    // F6 — a short receipt; zones are a row, one tap away.
    expect(screen.getByTestId('fert-sum-head')).toHaveTextContent(/ปุ๋ยเคมี 15-15-15 · ตราใบไม้ทอง/);
    expect(screen.getByTestId('fert-sum-net')).toHaveTextContent(/9,500\.00/);
    expect(screen.getByTestId(`fert-sum-line-${daeng}`)).toHaveTextContent(/แดง 6 กระสอบ.*ลงหนี้.*2,850\.00/);
    expect(screen.getByTestId(`fert-sum-line-${nat}`)).toHaveTextContent(/จ่ายแล้ว.*1,900\.00/);
    expect(screen.getByTestId('fert-sum-owner')).toHaveTextContent(/4,750\.00/);
    expect(screen.getByTestId('fert-sum-total')).toHaveTextContent(/รวมตรง 9,500\.00/);
    expect(screen.getByTestId('fert-sum-reasons')).toHaveTextContent(/ใส่ทำไม · 2 ข้อ/);
    expect(screen.getByTestId('fert-sum-zones')).toHaveTextContent(/บันทึกภายหลังได้/);
    press('fert-sum-zones');
    await flush();
    press(`fert-farm-${farm}`);
    type(`fert-zone-${zA}-sacks`, '6');
    press(`fert-zone-${zA}-reason-${YELLOW}`);
    press(`fert-zone-${zA}-add-note`);
    type(`fert-zone-${zA}-note`, 'ใบเหลืองแถวติดน้ำ');
    type(`fert-zone-${zB}-sacks`, '5');
    expect(screen.getByTestId('fert-zones-err')).toBeTruthy();
    press(`fert-zone-${zB}-less`);
    expect(screen.getByTestId('fert-zones-sum')).toHaveTextContent(/10 \/ 10 กระสอบ/);
    press('fert-zone-done');
    await flush();
    expect(screen.getByTestId('fert-sum-zones')).toHaveTextContent(/โซนริมคลอง 6 · โซนหลังบ้าน 4/);
    await act(async () => press('fert-save'));
    await flush();

    const events = await mockFinance.load();
    expect(events.some((e) => e.payload.t === 'debt_added')).toBe(false);
    expect(await created()).toHaveLength(before + 1);
    const fields = await lastFields();
    expect(fields).toMatchObject({
      amountSatang: 950_000,
      date: '2026-10-14',
      stage: 'actual',
      categoryId: 'cat-fertilizer',
      propertyId: farm,
      item: '15-15-15',
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
    // One tick remembered all three.
    const options = projectFinance(events).fertOptions;
    expect(options.map((o) => o.id)).toEqual(expect.arrayContaining([fertOptionId('formula', '15-15-15'), fertOptionId('brand', 'ตราใบไม้ทอง'), fertOptionId('sackKg', '50'), fertOptionId('reason', 'บำรุงต้น')]));
    expect(projectDebts(events).get(daeng)?.balanceSatang).toBe(285_000);
    expect(projectDebts(events).get(nat)?.balanceSatang ?? 0).toBe(0);
    // Drives all six steps; on a cold CI runner the first test also pays the module load.
  }, 20_000);

  it('a product bought before fills everything in one tap; the last price per sack is shown', async () => {
    wrap(<FertilizerFlowScreen />);
    await flush();
    expect(screen.getByTestId(`fert-prod-${PRODUCT}`)).toHaveTextContent(/15-15-15 · ตราใบไม้ทอง/);
    expect(screen.getByTestId(`fert-prod-${PRODUCT}`)).toHaveTextContent(/1,000\.00/);
    press(`fert-prod-${PRODUCT}`);
    expect(screen.getByTestId(`fert-prod-${PRODUCT}`).props.accessibilityState).toMatchObject({ checked: true });
    next();
    await flush();
    expect(screen.getByTestId('fert-product-line')).toHaveTextContent(/15-15-15 · ตราใบไม้ทอง/);
  });

  it('nothing picked: ถัดไป stays and says what is missing; going back keeps what was entered', async () => {
    wrap(<FertilizerFlowScreen />);
    await flush();
    next();
    expect(screen.getByTestId('fert-err')).toBeTruthy();
    await buy();
    next();
    await flush();
    prev();
    await flush();
    expect(screen.getByTestId('fert-sacks').props.value).toBe('10');
    expect(screen.getByTestId('fert-discount').props.value).toBe('500');
    prev();
    await flush();
    expect(screen.getByTestId('fert-picked')).toHaveTextContent(/15-15-15/);
  });

  it('a reason typed for this time only is chosen but not saved', async () => {
    wrap(<FertilizerFlowScreen />);
    await flush();
    await buy();
    next();
    await flush();
    press('fert-reason-new');
    await flush();
    type('fert-reason-name', 'ต้นโทรมหลังฝนชุก');
    press('fert-remember-reason');
    await act(async () => press('fert-reason-add'));
    await flush();
    expect(screen.getByTestId('fert-reason-text:ต้นโทรมหลังฝนชุก')).toHaveTextContent(/ใช้ครั้งนี้ครั้งเดียว/);
    expect(projectFinance(await mockFinance.load()).fertOptions.some((o) => o.name === 'ต้นโทรมหลังฝนชุก')).toBe(false);
  });

  it('search sits behind the top-bar icon and narrows the reasons', async () => {
    wrap(<FertilizerFlowScreen />);
    await flush();
    await buy();
    next();
    await flush();
    expect(screen.queryByTestId('fert-reason-search')).toBeNull();
    press('fert-search-open');
    type('fert-reason-search', 'เหลือง');
    expect(screen.getByTestId(`fert-reason-${YELLOW}`)).toBeTruthy();
    expect(screen.queryByTestId(`fert-reason-${fertOptionId('reason', 'บำรุงต้น')}`)).toBeNull();
  });

  it('no zones and leftover sacks: stock note on F5, the farm’s part shown once on the receipt', async () => {
    wrap(<FertilizerFlowScreen />);
    await flush();
    await buy({ discount: '' });
    next();
    await flush();
    next();
    await flush();
    next();
    await flush();
    press('fert-add-tapper');
    await flush();
    press(`fert-pick-${daeng}`);
    await flush();
    type(`fert-line-${daeng}-sacks`, '6');
    expect(screen.getByTestId('fert-split-head')).toHaveTextContent(/เหลือ 4 กระสอบ · เก็บเข้าสต็อก/);
    expect(screen.getByTestId('fert-split-head')).toHaveTextContent(/4,000\.00/);
    next();
    await flush();
    expect(screen.getByTestId('fert-sum-owner')).toHaveTextContent(/3,000\.00/);
    expect(screen.getByTestId('fert-sum-leftover')).toHaveTextContent(/4 กระสอบ.*4,000\.00/);
    expect(screen.getByTestId('fert-sum-total')).toHaveTextContent(/รวมตรง 10,000\.00/);
    await act(async () => press('fert-save'));
    await flush();
    const fields = await lastFields();
    expect(fields.fertilizer?.zones).toEqual([]);
    expect(fields.share).toMatchObject({ totalSacks: 10, lines: [{ sacks: 6 }] });
  });

  it('ไม่แบ่ง clears the tappers; the farm bears the whole cost', async () => {
    mockParams.current = { workerId: nat, name: 'นัด', bill: '1000' };
    wrap(<FertilizerFlowScreen />);
    await flush();
    await buy({ bill: '1000', discount: '' });
    for (let i = 0; i < 3; i++) {
      next();
      await flush();
    }
    expect(screen.getByTestId(`fert-line-${nat}`)).toBeTruthy();
    press('fert-no-share');
    expect(screen.queryByTestId(`fert-line-${nat}`)).toBeNull();
  });

  it('from add-debt: the tapper is preselected and given every sack; same one expense', async () => {
    mockParams.current = { workerId: nat, name: 'นัด' };
    const before = (await created()).length;
    wrap(<FertilizerFlowScreen />);
    await flush();
    await buy({ bill: '4000', discount: '' });
    for (let i = 0; i < 3; i++) {
      next();
      await flush();
    }
    expect(screen.getByTestId(`fert-line-${nat}-sacks`).props.value).toBe('10');
    next();
    await flush();
    await act(async () => press('fert-save'));
    await flush();
    expect(await created()).toHaveLength(before + 1);
    expect(await lastFields()).toMatchObject({ amountSatang: 400_000, categoryId: 'cat-fertilizer', share: { lines: [{ worker: { id: nat }, sacks: 10, settle: 'debt' }] } });
  });

  it('a farm with no zones offers "add zone" in the zones sheet; the new zone is a card at once', async () => {
    const bare = (await mockPeople.addProperty({ name: 'สวนฝั่งคลองพลู', crop: 'rubber' })).id;
    wrap(<FertilizerFlowScreen />);
    await flush();
    await buy();
    for (let i = 0; i < 4; i++) {
      next();
      await flush();
    }
    press('fert-sum-zones');
    await flush();
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

  it('tapping a receipt line goes back to that step', async () => {
    wrap(<FertilizerFlowScreen />);
    await flush();
    await buy();
    for (let i = 0; i < 4; i++) {
      next();
      await flush();
    }
    press('fert-sum-bill');
    await flush();
    expect(screen.getByTestId('fert-progress')).toHaveTextContent('2 จาก 6');
  });
});

describe('fertilizer flow — carried values, edits, plans (E11-S10)', () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
  });

  it('carries stage and payer from the expense form; planned reads "แค่วางแผน" and the debt comes when actual', async () => {
    mockParams.current = { bill: '1000', date: '2026-10-14', stage: 'planned', payerId: nat, payerName: 'นัด' };
    wrap(<FertilizerFlowScreen />);
    await flush();
    await buy({ bill: '1000', discount: '' });
    next();
    await flush();
    next();
    await flush();
    expect(screen.getByTestId(`fert-payer-${nat}`).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId(`fert-payer-${nat}`)).toHaveTextContent(/สวนต้องคืน 1,000\.00/);
    expect(screen.getByTestId('fert-details')).toHaveTextContent(/แค่วางแผน/);
    next();
    await flush();
    press('fert-add-tapper');
    await flush();
    press(`fert-pick-${daeng}`);
    await flush();
    expect(screen.getByTestId(`fert-line-${daeng}-hint`)).toHaveTextContent(/เกิดจริง/);
    press(`fert-line-${daeng}-pct`);
    await flush();
    press('fert-pct-settings');
    expect(mockRouter.push).toHaveBeenCalledWith('/v2/fertilizer-settings');
  });

  it('the % button opens a small picker; the share follows it', async () => {
    wrap(<FertilizerFlowScreen />);
    await flush();
    await buy({ discount: '' });
    for (let i = 0; i < 3; i++) {
      next();
      await flush();
    }
    press('fert-add-tapper');
    await flush();
    press(`fert-pick-${daeng}`);
    await flush();
    press(`fert-line-${daeng}-pct`);
    await flush();
    type('fert-pct-input', '30');
    press('fert-pct-done');
    await flush();
    expect(screen.getByTestId(`fert-line-${daeng}-pct`)).toHaveTextContent('30%');
    expect(screen.getByTestId(`fert-line-${daeng}-part`)).toHaveTextContent(/3,000\.00/);
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
    return { patch: (evs[evs.length - 1].payload as { patch: Record<string, unknown> }).patch, base: evs[evs.length - 1].baseEventId };
  };

  it('edit: opens on the receipt, prefilled; a bill change writes only amount + share, on the head', async () => {
    const head = await seed('exp-edit', { t: 'expense_created', fields: purchase({ amountSatang: 300_000, share: { billSatang: 300_000, discountSatang: 0, totalSacks: 3, lines: [{ worker: { id: daeng, name: 'แดง' }, sacks: 3, workerPct: 50, settle: 'debt' }] } }) });
    mockParams.current = { id: 'exp-edit' };
    wrap(<FertilizerFlowScreen />);
    await flush();
    expect(screen.getByText('แก้การซื้อปุ๋ย')).toBeTruthy();
    expect(screen.getByTestId('fert-progress')).toHaveTextContent('6 จาก 6');
    press('fert-sum-bill');
    await flush();
    expect(screen.getByTestId('fert-bill').props.value).toBe('3000.00');
    type('fert-bill', '3300');
    for (let i = 0; i < 4; i++) {
      next();
      await flush();
    }
    await act(async () => press('fert-save'));
    await flush();
    const { patch, base } = await lastPatch('exp-edit');
    expect(base).toBe(head);
    expect(Object.keys(patch).sort()).toEqual(['amountSatang', 'share']);
  });

  it('edit: a share change writes the net amount with it; the item follows the formula', async () => {
    await seed('exp-r1', { t: 'expense_created', fields: purchase() });
    mockParams.current = { id: 'exp-r1' };
    wrap(<FertilizerFlowScreen />);
    await flush();
    press('fert-sum-head');
    await flush();
    press('fert-new');
    await flush();
    type('fert-formula', '46-0-0');
    press('fert-remember');
    await act(async () => press('fert-new-done'));
    await flush();
    press('fert-step-5');
    await flush();
    press(`fert-line-${daeng}-pct`);
    await flush();
    type('fert-pct-input', '40');
    press('fert-pct-done');
    await flush();
    press('fert-step-6');
    await flush();
    await act(async () => press('fert-save'));
    await flush();
    const { patch } = await lastPatch('exp-r1');
    expect(Object.keys(patch).sort()).toEqual(['amountSatang', 'fertilizer', 'item', 'share']);
    expect(patch.item).toBe('46-0-0');
    expect(patch.amountSatang).toBe(200_000);
  });

  it('a renamed option frees its old name; remembering a hidden reason brings back its description', async () => {
    const oldId = fertOptionId('formula', '13-13-21');
    await seed(oldId, { t: 'fert_option_set', kind: 'formula', name: '13-13-21 ตราม้า', description: '', hidden: false });
    const burnt = fertOptionId('reason', 'ใบไหม้');
    await seed(burnt, { t: 'fert_option_set', kind: 'reason', name: 'ใบไหม้', description: 'ขอบใบไหม้', hidden: true });
    mockParams.current = { bill: '1000' };
    wrap(<FertilizerFlowScreen />);
    await flush();
    press('fert-new');
    await flush();
    type('fert-formula', '13-13-21');
    await act(async () => press('fert-new-done'));
    await flush();
    next();
    await flush();
    type('fert-sacks', '1');
    next();
    await flush();
    press('fert-reason-new');
    await flush();
    type('fert-reason-name', 'ใบไหม้');
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

  it('the % for fertilizer is set here, naming the head it saw', async () => {
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
});
