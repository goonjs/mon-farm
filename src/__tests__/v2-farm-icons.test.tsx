/**
 * E03-S11 FM-7: the farm screens draw the traced FarmMate originals where an
 * icon names the row or tile (owner 2026-11-03). A person's tile is drawn by
 * role; an empty tapper slot keeps its line icon (a picture would say someone
 * is there); bank accounts keep theirs (no original).
 */
import { act, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { todayIso } from '../core/master';
import type { MasterStore } from '../store/master-store';
import { wrap } from '../test/render';
import { FarmMateArt } from '../ui';
import { BuyersScreen } from '../v2/farm/buyers-screen';
import { FarmHubScreen } from '../v2/farm/farm-hub';
import { FarmsScreen, PropertyScreen } from '../v2/farm/farms-screens';
import { PeopleScreen, PersonScreen } from '../v2/farm/people-screens';
import { PointScreen, PointsScreen } from '../v2/farm/points-screens';
import { SharesScreen } from '../v2/farm/shares-screens';

jest.mock('../store/people', () => {
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { peopleStore: new MemoryPeopleStore() };
});
jest.mock('../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
});
jest.mock('../store/account', () => {
  const { MemoryAccountStore } = jest.requireActual('../store/account-memory');
  return { accountStore: new MemoryAccountStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('expo-router', () => {
  const params: { current: Record<string, string> } = { current: {} };
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => true) };
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
const master = () => (jest.requireMock('../store/people') as { peopleStore: MasterStore }).peopleStore;

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** The originals drawn inside the element with this testID. */
function art(testID: string): string[] {
  return within(screen.getByTestId(testID)).UNSAFE_queryAllByType(FarmMateArt).map((a) => a.props.id as string);
}

const ids: Record<string, string> = {};
beforeAll(async () => {
  const m = master();
  ids.red = (await m.create('แดง', ['tapper'])).id;
  ids.mgr = (await m.create('อ.สมหวัง', ['manager'])).id;
  ids.own = (await m.create('เจ้าของ', ['owner'])).id;
  ids.buyer = (await m.addBuyer('คนรับซื้อยาง ก')).id;
  ids.farm = (await m.addProperty({ name: 'จันทเขลม', crop: 'rubber' })).id;
  ids.p1 = (await m.addPoint(ids.farm, 'จุด 1')).id;
  ids.p2 = (await m.addPoint(ids.farm, 'จุด 2')).id;
  ids.assignment = await m.assignTapper(ids.p1, ids.red, null);
  await m.setShare(ids.red, 55, todayIso(Date.now()));
});
beforeEach(() => {
  mockParams.current = {};
});

it('ข้อมูลฟาร์ม: farms, people, buyers and sale settings draw originals; bank accounts keep the line icon', async () => {
  wrap(<FarmHubScreen />);
  await flush();
  expect(art('hub-farms')).toEqual(['farm.allFarms']);
  expect(art('hub-people')).toEqual(['people.contacts']);
  expect(art('hub-buyers')).toEqual(['people.buyer']);
  expect(art('hub-accounts')).toEqual([]);
  expect(art('hub-sale-settings')).toEqual(['system.appSettings']);
});

it('สวนและจุดชั่ง and a farm: farm tiles are the farm, point tiles the weighing point', async () => {
  wrap(<FarmsScreen />);
  await flush();
  expect(art(`farm-${ids.farm}`)).toEqual(['nav.myFarm']);
  screen.unmount();
  mockParams.current = { id: ids.farm };
  wrap(<PropertyScreen />);
  await flush();
  expect(art('property-summary')).toEqual(['nav.myFarm']);
  expect(art(`point-${ids.p1}`)).toEqual(['farm.weighPoint']);
});

it('จุดชั่ง and a point: the point is the weighing point, its tapper the tapper', async () => {
  wrap(<PointsScreen />);
  await flush();
  expect(art(`point-${ids.p2}`)).toEqual(['farm.weighPoint']);
  screen.unmount();
  mockParams.current = { id: ids.p1 };
  wrap(<PointScreen />);
  await flush();
  expect(art('point-summary')).toEqual(['farm.weighPoint']);
  expect(art(`assignment-${ids.assignment}`)).toEqual(['people.tapper']);
});

it('คน: each person by role; a person page leads with its role, its points and share', async () => {
  wrap(<PeopleScreen />);
  await flush();
  expect(art(`person-${ids.red}`)).toEqual(['people.tapper']);
  expect(art(`person-${ids.mgr}`)).toEqual(['people.manager']);
  expect(art(`person-${ids.own}`)).toEqual(['nav.profile']);
  screen.unmount();
  mockParams.current = { id: ids.red };
  wrap(<PersonScreen />);
  await flush();
  expect(art('person-profile')).toEqual(['people.tapper']);
  expect(art(`person-point-${ids.p1}`)).toEqual(['farm.weighPoint']);
  expect(art('share-summary')).toEqual(['people.profitShare']);
});

it('คนรับซื้อยาง and ส่วนแบ่ง draw the buyer and the share', async () => {
  wrap(<BuyersScreen />);
  await flush();
  expect(art(`buyer-${ids.buyer}`)).toEqual(['people.buyer']);
  screen.unmount();
  wrap(<SharesScreen />);
  await flush();
  expect(art(`share-${ids.red}`)).toEqual(['people.profitShare']);
});

it('the buyers filter on คน draws the buyer', async () => {
  mockParams.current = { filter: 'buyers' };
  wrap(<PeopleScreen />);
  await flush();
  expect(art(`buyer-${ids.buyer}`)).toEqual(['people.buyer']);
});
