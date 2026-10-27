import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { fertOptionId } from '../../../core/finance/ledger';
import type { ExpenseFields, FinanceEvent } from '../../../core/finance/types';
import { financeStore as mockFinance } from '../../../store/finance';
import { wrap } from '../../../test/render';
import { OrderScreen } from './order-screen';

jest.mock('../../../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../../../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
});
jest.mock('../../../store/people', () => {
  const { MemoryPeopleStore } = jest.requireActual('../../../store/people-memory');
  return { peopleStore: new MemoryPeopleStore() };
});
jest.mock('../../../store/store', () => {
  const { MemoryStore } = jest.requireActual('../../../store/memory-store');
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
  router: { push: jest.Mock; replace: jest.Mock; back: jest.Mock };
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
const keys = (pad: string, ...ks: string[]) => ks.forEach((k) => press(`${pad}-key-${k}`));
const created = async () => (await mockFinance.load()).filter((e) => e.payload.t === 'expense_created');
const fieldsOf = (e: FinanceEvent) => (e.payload as { fields: ExpenseFields }).fields;
const text = (id: string): string => {
  const flat = (n: unknown): string => (Array.isArray(n) ? n.map(flat).join('') : n && typeof n === 'object' ? flat((n as { props: { children?: unknown } }).props.children) : String(n ?? ''));
  return flat(screen.getByTestId(id).props.children);
};

/** Opens the pick sheet, makes a new fertilizer (not remembered) and fills the item sheet. */
async function addNewFert(formula: string, qty: string[], price: string[]) {
  press('ordc-add');
  press('ordc-pick-new');
  fireEvent.changeText(screen.getByTestId('ordc-formula'), formula);
  press('ordc-remember');
  press('ordc-new-done');
  await flush();
  press('ordc-qty');
  keys('ordc-qty-pad', ...qty, 'done');
  press('ordc-price');
  keys('ordc-price-pad', ...price);
  press('ordc-price-done');
  press('ordc-item-done');
  await flush();
}

const PRODUCT = 'chemical|15-15-15|ตราใบไม้ทอง|50';

beforeAll(async () => {
  await seed(fertOptionId('formula', '15-15-15'), { t: 'fert_option_set', kind: 'formula', name: '15-15-15', description: '', hidden: false });
  await seed('exp-old', {
    t: 'expense_created',
    fields: {
      amountSatang: 2_300_000, date: '2026-09-01', stage: 'actual', categoryId: 'cat-fertilizer', propertyId: null, item: '15-15-15', note: '',
      payer: { id: 'farm', name: 'เงินสวน' }, orderId: 'ord-old', discountSatang: 0,
      fertilizer: { type: 'chemical', formula: '15-15-15', brand: 'ตราใบไม้ทอง', sackKg: 50, reasons: [], zones: [], shop: 'ร้านปุ๋ยเจริญ', orderedBy: '', sacks: 20, pricePerSackSatang: 115_000, itemDiscountSatang: 0 },
    },
  });
});

describe('order capture screen (E11-S11)', () => {
  beforeEach(() => {
    mockParams.current = {};
    mockRouter.replace.mockClear();
    mockRouter.back.mockClear();
  });

  it('starts empty: save disabled, stage "สั่งไว้" by default, no bill-discount link yet', async () => {
    wrap(<OrderScreen />);
    await flush();
    expect(screen.getByTestId('ordc-empty')).toBeTruthy();
    expect(screen.getByTestId('ordc-save').props.accessibilityState.disabled).toBe(true);
    expect(text('ordc-total')).toContain('0.00');
    expect(screen.queryByTestId('ordc-bill-link')).toBeNull();
    // the stage control only shows with items
    await addNewFert('46-0-0', ['1', '0'], ['9', '5', '0']);
    expect(screen.getByTestId('ordc-stage-committed').props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId('ordc-stage-actual').props.accessibilityState.checked).toBe(false);
  });

  it('adds two items, totals them, saves two expenses sharing one orderId', async () => {
    const before = (await created()).length;
    wrap(<OrderScreen />);
    await flush();
    await addNewFert('15-15-15', ['2', '0'], ['1', '1', '5', '0']);
    await addNewFert('46-0-0', ['1', '0'], ['9', '5', '0']);
    expect(text('ordc-count')).toContain('2');
    expect(text('ordc-total')).toContain('32,500.00');
    press('ordc-save');
    await flush();
    expect(screen.getByTestId('ordc-saved')).toBeTruthy();
    expect(text('ordc-saved-total')).toContain('32,500.00');
    const made = (await created()).slice(before);
    expect(made).toHaveLength(2);
    const [a, b] = made.map(fieldsOf);
    expect(a.orderId).toBeTruthy();
    expect(a.orderId).toBe(b.orderId);
    expect([a.amountSatang, b.amountSatang]).toEqual([2_300_000, 950_000]);
    expect(a.stage).toBe('committed');
    expect(a.categoryId).toBe('cat-fertilizer');
    expect(a.fertilizer).toMatchObject({ formula: '15-15-15', sacks: 20 });
    // "ใส่รายละเอียดปุ๋ย" goes to the order detail page
    press('ordc-saved-details');
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/v2/order/[orderId]', params: { orderId: a.orderId } });
  });

  it('"เสร็จ ไว้ทีหลัง" leaves the screen', async () => {
    wrap(<OrderScreen />);
    await flush();
    await addNewFert('46-0-0', ['5'], ['9', '5', '0']);
    press('ordc-save');
    await flush();
    press('ordc-saved-later');
    expect(mockRouter.replace).toHaveBeenCalledWith('/v2/expenses');
  });

  it('item discount and bill discount: secondary links, applied to the total, split on save', async () => {
    const before = (await created()).length;
    wrap(<OrderScreen />);
    await flush();
    await addNewFert('15-15-15', ['2', '0'], ['1', '1', '5', '0']);
    await addNewFert('46-0-0', ['1', '0'], ['9', '5', '0']);
    expect(screen.getByTestId('ordc-bill-link')).toBeTruthy();
    // item discount 500.00 on the first item, behind its own secondary link
    fireEvent.press(screen.getByLabelText(/แก้รายการ 15-15-15/));
    expect(screen.queryByTestId('ordc-discount')).toBeNull();
    press('ordc-discount-link');
    press('ordc-discount');
    keys('ordc-discount-pad', '5', '0', '0');
    press('ordc-discount-done');
    expect(text('ordc-line-total-amount')).toBe('22,500.00');
    press('ordc-item-done');
    expect(text('ordc-total')).toContain('32,000.00');
    // bill discount 1,000.00
    press('ordc-bill-link');
    press('ordc-bill');
    keys('ordc-bill-pad', '1', '000');
    press('ordc-bill-done');
    press('ordc-bill-ok');
    expect(text('ordc-total')).toContain('31,000.00');
    expect(text('ordc-bill-shown')).toContain('1,000.00');
    press('ordc-save');
    await flush();
    const made = (await created()).slice(before).map(fieldsOf);
    expect(made.reduce((s, f) => s + (f.amountSatang ?? 0), 0)).toBe(3_100_000);
    expect(made.reduce((s, f) => s + (f.discountSatang ?? 0), 0)).toBe(150_000);
    expect(made[0].fertilizer?.itemDiscountSatang).toBe(50_000);
  });

  it('opens the first item with a typed total from the expense form (amount param)', async () => {
    mockParams.current = { amount: '23000' };
    wrap(<OrderScreen />);
    await flush();
    press('ordc-add');
    press(`ordc-pick-${PRODUCT}`);
    await flush();
    expect(text('ordc-line-total-amount')).toBe('23,000.00');
    expect(screen.getByTestId('ordc-price-mode-total').props.accessibilityState.checked).toBe(true);
  });

  it('a product bought before is offered with its last price; picking it fills the price', async () => {
    wrap(<OrderScreen />);
    await flush();
    press('ordc-add');
    expect(screen.getByTestId(`ordc-pick-${PRODUCT}`)).toBeTruthy();
    expect(screen.getAllByText(/ครั้งก่อน 1,150.00/).length).toBeGreaterThan(0);
    press(`ordc-pick-${PRODUCT}`);
    await flush();
    press('ordc-qty');
    keys('ordc-qty-pad', '4', 'done');
    expect(text('ordc-line-total-amount')).toBe('4,600.00');
  });

  it('validation is inline: a missing quantity and price are named on "ใส่ในใบซื้อ"', async () => {
    wrap(<OrderScreen />);
    await flush();
    press('ordc-add');
    press('ordc-pick-new');
    fireEvent.changeText(screen.getByTestId('ordc-formula'), '8-24-24');
    press('ordc-new-done');
    await flush();
    press('ordc-item-done');
    expect(screen.getByTestId('ordc-err-qty')).toBeTruthy();
    expect(screen.getByTestId('ordc-err-price')).toBeTruthy();
    expect(screen.queryByTestId('ordc-empty')).toBeTruthy();
  });

  it('a new fertilizer needs a formula, said at the field', async () => {
    wrap(<OrderScreen />);
    await flush();
    press('ordc-add');
    press('ordc-pick-new');
    press('ordc-new-done');
    expect(screen.getByText('ใส่สูตรหรือชื่อปุ๋ย')).toBeTruthy();
  });

  it('other items sit behind a small link; their unit is a dropdown', async () => {
    wrap(<OrderScreen />);
    await flush();
    press('ordc-add');
    press('ordc-pick-other');
    fireEvent.changeText(screen.getByTestId('ordc-name'), 'ไกลโฟเซต');
    press('ordc-qty');
    keys('ordc-qty-pad', '1', '0', 'done');
    press('ordc-unit');
    press('ordc-unit-ลิตร');
    press('ordc-price');
    keys('ordc-price-pad', '3', '2', '0');
    press('ordc-price-done');
    expect(text('ordc-line-total-amount')).toBe('3,200.00');
    press('ordc-item-done');
    await flush();
    press('ordc-save');
    await flush();
    const made = await created();
    const f = fieldsOf(made[made.length - 1]);
    expect(f).toMatchObject({ categoryId: 'cat-herbicide', item: 'ไกลโฟเซต', amountSatang: 320_000 });
    expect(f.fertilizer).toBeUndefined();
  });

  it('repeatOf prefills the same items, quantities and prices, date today, stage committed', async () => {
    mockParams.current = { repeatOf: 'ord-old', date: '2026-01-01', stage: 'actual' };
    wrap(<OrderScreen />);
    await flush();
    expect(text('ordc-count')).toContain('1');
    expect(text('ordc-total')).toContain('23,000.00');
    expect(screen.getByTestId('ordc-stage-committed').props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId('ordc-date')).toHaveTextContent(/วันนี้/);
    expect(screen.getByTestId('ordc-shop')).toHaveTextContent(/ร้านปุ๋ยเจริญ/);
    expect(screen.getByTestId('ordc-save').props.accessibilityState.disabled).toBe(false);
  });

  it('the stage and payer can be changed; the payer sheet applies the pick', async () => {
    wrap(<OrderScreen />);
    await flush();
    await addNewFert('46-0-0', ['5'], ['9', '5', '0']);
    press('ordc-stage-actual');
    expect(screen.getByTestId('ordc-stage-actual').props.accessibilityState.checked).toBe(true);
    expect(text('ordc-payer-title')).toContain('เงินสวน');
    press('ordc-payer');
    expect(screen.getByTestId('ordc-payer-sheet')).toBeTruthy();
    press('ordc-payer-done');
    press('ordc-save');
    await flush();
    const made = await created();
    expect(fieldsOf(made[made.length - 1]).stage).toBe('actual');
  });
});
