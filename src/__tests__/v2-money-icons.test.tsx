/**
 * E03-S11 FM-6: the money screens draw the traced FarmMate originals where an
 * icon names the row or tile (owner 2026-11-03). Small icons inside a line of
 * text stay line icons; a person's tile is drawn by role.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { FinanceEvent } from '../core/finance/types';
import { financeStore as mockFinance } from '../store/finance';
import { peopleStore as mockPeople } from '../store/people';
import { wrap } from '../test/render';
import { FarmMateArt } from '../ui';
import { DebtAccountScreen, DebtsScreen } from '../v2/money/debts-screens';
import { ExpenseFormScreen } from '../v2/money/expense-form-screen';
import { OwedScreen } from '../v2/money/owed-screen';

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
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => params.current,
    useRouter: () => router,
    router,
    __params: params,
  };
});
const { __params: mockParams } = jest.requireMock('expo-router') as { __params: { current: Record<string, string> } };

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** The originals drawn inside the element with this testID. */
function art(testID: string): string[] {
  return within(screen.getByTestId(testID)).UNSAFE_queryAllByType(FarmMateArt).map((a) => a.props.id as string);
}

let seq = 0;
async function append(targetId: string, payload: FinanceEvent['payload']) {
  seq += 1;
  await mockFinance.append({ id: `e-${seq}`, groupId: 'group-1', deviceSeq: seq, ts: seq, actor: { userId: 'u', deviceId: 'dev-other' }, source: 'app', targetId, baseEventId: null, payload });
}

const ids: Record<string, string> = {};
beforeAll(async () => {
  ids.daeng = (await mockPeople.create('แดง', ['tapper'])).id;
  ids.somwang = (await mockPeople.create('อาจารย์สมหวัง', ['manager'])).id;
  ids.owner = (await mockPeople.create('เจ้าของสวน', ['owner'])).id;
  for (const [key, name] of [['daeng', 'แดง'], ['somwang', 'อาจารย์สมหวัง'], ['owner', 'เจ้าของสวน']] as const) {
    await append(`x-${key}`, {
      t: 'expense_created',
      fields: { amountSatang: 10000, date: '2026-09-01', stage: 'actual', categoryId: null, propertyId: null, item: '', note: '', payer: { id: ids[key], name } },
    });
  }
  await append('debt-1', {
    t: 'debt_added',
    fields: { worker: { id: ids.daeng, name: 'แดง' }, kind: 'loan', amountSatang: 300000, date: '2026-09-20', note: '', lender: null, fertilizer: null, carriedForward: false },
  });
  await append('cat-repair', { t: 'category_share_set', workerPct: 50 });
});

describe('บันทึกค่าใช้จ่าย', () => {
  beforeEach(() => {
    mockParams.current = { id: 'new' };
  });

  it('category tiles and the "more" tile draw the originals', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    expect(art('expense-cat-cat-fertilizer')).toEqual(['farmwork.fertilize']);
    expect(art('expense-cat-cat-labour')).toEqual(['finance.workerPay']);
    expect(art('expense-cat-cat-fuel')).toEqual(['materials.fuel']);
    expect(art('expense-cat-cat-herbicide')).toEqual(['materials.pesticide']);
    expect(art('expense-cat-cat-travel')).toEqual(['people.transporter']);
    expect(art('expense-cat-more')).toEqual(['nav.more']);
  });

  it('who paid first, and the share row, lead with an original', async () => {
    wrap(<ExpenseFormScreen />);
    await flush();
    expect(art('expense-payer-row')).toEqual(['finance.expense']);
    fireEvent.press(screen.getByTestId('expense-cat-more'));
    fireEvent.press(screen.getByTestId('expense-catall-cat-repair'));
    expect(art('share-row')).toEqual(['people.tapper']);
  });
});

it('ค้างใคร: each person tile is drawn by role', async () => {
  wrap(<OwedScreen />);
  await flush();
  expect(art(`owed-open-${ids.daeng}`)).toEqual(['people.tapper']);
  expect(art(`owed-open-${ids.somwang}`)).toEqual(['people.manager']);
  expect(art(`owed-open-${ids.owner}`)).toEqual(['nav.profile']);
});

it('บัญชีหนี้: the list tile is the tapper; the account\'s plan tile is the calendar', async () => {
  wrap(<DebtsScreen />);
  await flush();
  expect(art(`debt-account-${ids.daeng}`)).toEqual(['people.tapper']);
  screen.unmount();
  mockParams.current = { workerId: ids.daeng, name: 'แดง' };
  wrap(<DebtAccountScreen />);
  await flush();
  expect(art('debt-plan-row')).toEqual(['farmwork.calendar']);
});
