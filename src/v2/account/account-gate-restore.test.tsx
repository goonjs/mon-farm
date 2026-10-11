import { act, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AccountGate } from './account-gate';
import { userFromSignIn } from '../../core/user';
import { MemoryAccountStore } from '../../store/account-memory';
import type { SyncRemote } from '../../sync/client';
import { sessionGroupId, sessionUserId, setSessionGroup, setSessionUser } from '../../store/session';
import { wrap } from '../../test/render';

/**
 * E02-S05: a returning member on a new device must find their farm and never
 * be offered a second group. The server is asked before create-group shows.
 */

const mockStartSync = jest.fn(() => ({ engine: { subscribe: jest.fn() }, stop: jest.fn() }));
jest.mock('../../sync/runtime', () => ({ startSync: (...args: unknown[]) => (mockStartSync as (...a: unknown[]) => unknown)(...args) }));

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: unknown }) => children,
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
}));

const somchai = userFromSignIn('uid-1', 'สมชาย', { provider: 'google', subject: 'g-1' });
const home = <Text testID="app-inside">inside</Text>;

type Ref = { groupId: string; name: string };
type Lookup = (userId: string) => Promise<{ myGroups: () => Promise<Ref[]> } | null>;
const groupsOf =
  (...groups: Ref[]): Lookup =>
  async () => ({ myGroups: async () => groups });
const farm: Ref = { groupId: 'g-farm', name: 'สวนสมชาย' };

beforeEach(() => {
  setSessionUser(null);
  setSessionGroup(null);
  mockStartSync.mockClear();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

const press = async (testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
  await flush();
};

async function render(accounts: MemoryAccountStore, lookup: Lookup, connect: jest.Mock = jest.fn(async () => null)) {
  wrap(
    <AccountGate accounts={accounts} google={{ signIn: async () => somchai }} lookup={lookup} connect={connect}>
      {home}
    </AccountGate>,
  );
  for (let i = 0; i < 4; i++) await flush();
}

async function signedInAccounts() {
  const accounts = new MemoryAccountStore();
  await accounts.saveUser(somchai);
  return accounts;
}

it('AC1/AC2: after sign-in it asks the server for this user, keeps the group on the device and goes in with no create screen', async () => {
  const asked: string[] = [];
  let answer: (g: Ref[]) => void = () => undefined;
  const lookup: Lookup = async (userId) => {
    asked.push(userId);
    return { myGroups: () => new Promise((resolve) => (answer = resolve)) };
  };
  const accounts = new MemoryAccountStore();
  await render(accounts, lookup);
  await press('signin-google');
  expect(asked).toEqual(['uid-1']);
  expect(screen.getByTestId('group-check')).toBeTruthy();
  expect(screen.getByText('กำลังดึงรายการกลุ่มฟาร์มของคุณ…')).toBeTruthy();
  expect(screen.queryByTestId('group-start')).toBeNull();
  expect(screen.queryByTestId('app-inside')).toBeNull();

  await act(async () => answer([farm]));
  await flush();
  expect(screen.getByTestId('app-inside')).toBeTruthy();
  expect(screen.queryByTestId('group-start')).toBeNull();
  expect(await accounts.memberships()).toEqual([{ groupId: 'g-farm', userId: 'uid-1', name: 'สวนสมชาย', role: 'owner' }]);
  expect(await accounts.pendingOps()).toEqual([]);
  expect(sessionGroupId()).toBe('g-farm');
  expect(sessionUserId()).toBe('uid-1');
});

it('AC8: the restored group starts sync for it, so its events are pulled', async () => {
  const connect = jest.fn(async () => ({}) as SyncRemote);
  await render(await signedInAccounts(), groupsOf(farm), connect);
  expect(connect).toHaveBeenCalledWith('uid-1', 'g-farm');
  expect(mockStartSync).toHaveBeenCalledWith(expect.objectContaining({ scope: { userId: 'uid-1', groupId: 'g-farm' } }));
});

it('AC3: several groups are all kept and the oldest one opens', async () => {
  const accounts = await signedInAccounts();
  await render(accounts, groupsOf({ groupId: 'g-second', name: 'สวนสอง' }, farm));
  expect(screen.getByTestId('app-inside')).toBeTruthy();
  expect(sessionGroupId()).toBe('g-farm');
  expect((await accounts.memberships()).map((m) => m.groupId)).toEqual(['g-farm', 'g-second']);
});

it('AC4: the server answered with no groups: create-group, as before', async () => {
  await render(await signedInAccounts(), groupsOf());
  expect(screen.getByTestId('group-start')).toBeTruthy();
  expect(screen.queryByTestId('group-check-failed')).toBeNull();
});

it('AC5: when the server cannot be asked it says so with a retry and offers no create-group', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  let fail = true;
  const lookup: Lookup = async () => ({
    myGroups: async () => {
      if (fail) throw new Error('offline');
      return [farm];
    },
  });
  const accounts = await signedInAccounts();
  await render(accounts, lookup);
  expect(screen.getByTestId('group-check-failed')).toBeTruthy();
  expect(screen.getByText('ดึงรายการกลุ่มไม่สำเร็จ — ต่อเน็ตแล้วลองอีกครั้ง')).toBeTruthy();
  expect(screen.queryByTestId('group-start')).toBeNull();
  expect(screen.queryByTestId('group-create')).toBeNull();
  expect(screen.queryByTestId('app-inside')).toBeNull();
  expect(await accounts.memberships()).toEqual([]);

  fail = false;
  await press('group-check-retry');
  expect(screen.getByTestId('app-inside')).toBeTruthy();
  expect(sessionGroupId()).toBe('g-farm');
});

it('AC5: a lookup that cannot even connect is the same failed state', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  await render(await signedInAccounts(), async () => Promise.reject(new Error('no sdk')));
  expect(screen.getByTestId('group-check-failed')).toBeTruthy();
  expect(screen.queryByTestId('group-start')).toBeNull();
});

it('AC5: a lookup that never answers gives up after 10 s, and a late answer does not enter the app', async () => {
  jest.useFakeTimers();
  try {
    let answer: (g: Ref[]) => void = () => undefined;
    const lookup: Lookup = async () => ({ myGroups: () => new Promise((resolve) => (answer = resolve)) });
    const accounts = await signedInAccounts();
    await render(accounts, lookup);
    expect(screen.getByTestId('group-check')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(9_999);
    });
    expect(screen.getByTestId('group-check')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('group-check-failed')).toBeTruthy();
    await act(async () => answer([farm]));
    expect(screen.getByTestId('group-check-failed')).toBeTruthy();
    expect(await accounts.memberships()).toEqual([]);
  } finally {
    jest.useRealTimers();
  }
});

it('AC6: opening the app again with a user and no group repeats the check instead of offering create', async () => {
  const lookup = jest.fn(groupsOf(farm));
  await render(await signedInAccounts(), lookup);
  expect(lookup).toHaveBeenCalledWith('uid-1');
  expect(screen.getByTestId('app-inside')).toBeTruthy();
});

it('AC7: a device that already has the group goes straight in and never asks the network', async () => {
  const accounts = await signedInAccounts();
  await accounts.saveMemberships([{ groupId: 'g-farm', userId: 'uid-1', name: 'สวนสมชาย', role: 'owner' }]);
  const lookup = jest.fn(groupsOf());
  await render(accounts, lookup);
  expect(screen.getByTestId('app-inside')).toBeTruthy();
  expect(lookup).not.toHaveBeenCalled();
});

it("AC7: another account's group on the device does not stop the check", async () => {
  const accounts = await signedInAccounts();
  await accounts.saveMemberships([{ groupId: 'g-other', userId: 'uid-2', name: 'สวนคนอื่น', role: 'owner' }]);
  const lookup = jest.fn(groupsOf(farm));
  await render(accounts, lookup);
  expect(lookup).toHaveBeenCalled();
  expect(sessionGroupId()).toBe('g-farm');
});

it('a build with no backend (nothing to ask) stays local: create-group as before', async () => {
  await render(await signedInAccounts(), async () => null);
  expect(screen.getByTestId('group-start')).toBeTruthy();
});

it('when the device cannot keep what the server said, it does not enter and does not offer create: retry', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const accounts = await signedInAccounts();
  accounts.saveMemberships = async () => {
    throw new Error('quota');
  };
  await render(accounts, groupsOf(farm));
  expect(screen.getByTestId('group-check-failed')).toBeTruthy();
  expect(screen.queryByTestId('group-start')).toBeNull();
  expect(screen.queryByTestId('app-inside')).toBeNull();
});
