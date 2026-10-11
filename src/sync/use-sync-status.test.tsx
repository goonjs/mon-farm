import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FIXTURE_GROUP_ID, LogBuilder } from '../core/fixtures';
import { newGroup } from '../core/group';
import type { SaleEvent } from '../core/types';
import { userFromSignIn } from '../core/user';
import { accountStore as mockAccounts } from '../store/account';
import { emitAppended } from '../store/append-signal';
import { setSessionGroup, setSessionUser } from '../store/session';
import { store as mockStore } from '../store/store';
import { emitSyncChanged, setEngineStatus } from './changed';
import { useSyncStatus } from './use-sync-status';

jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('../store/account', () => {
  const { MemoryAccountStore } = jest.requireActual('../store/account-memory');
  return { accountStore: new MemoryAccountStore() };
});
// The real hook runs its callback on focus; here the screen is always focused.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]) };
});

/** E01-S09: the badge counts what THIS user still has to send for THIS group, nothing else. */
function Badge() {
  const status = useSyncStatus();
  return <Text testID="badge">{status ? `${status.state}:${status.count}` : 'unknown'}</Text>;
}

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

const somchai = userFromSignIn('user-somchai', 'สมชาย', { provider: 'google', subject: 'g-1' });

beforeEach(async () => {
  setSessionUser('user-somchai');
  setSessionGroup(FIXTURE_GROUP_ID);
  // The mocked stores live for the whole file: start each test with an empty outbox.
  await mockStore.markSynced((await mockStore.pending()).map((e) => e.id));
  for (const op of await mockAccounts.pendingOps()) await mockAccounts.completeOp(op);
});

const record = async (events: SaleEvent[]) => {
  for (const e of events) await mockStore.append(e);
};

describe('useSyncStatus', () => {
  it('counts only this user\'s events in this group; others stay out of the number', async () => {
    const { deviceId } = await mockStore.device();
    const mine = new LogBuilder('s1', deviceId).accept('p1').accept('p1').build();
    const [other] = new LogBuilder('s2', deviceId).accept('p1').build();
    await record([
      ...mine,
      { ...other, id: 'x-1', groupId: 'group-9' } as SaleEvent,
      { ...other, id: 'x-2', actor: { ...other.actor, userId: 'user-mallory' } } as SaleEvent,
    ]);
    render(<Badge />);
    await flush();
    expect(screen.getByTestId('badge').props.children).toBe('pending:2');
  });

  it('a group still to be created counts as waiting, and stops counting when the engine has sent it', async () => {
    const { membership, op } = newGroup(FIXTURE_GROUP_ID, 'สวน', somchai, 1);
    await mockAccounts.createGroup(membership, op);
    render(<Badge />);
    await flush();
    expect(screen.getByTestId('badge').props.children).toBe('pending:1');

    await mockAccounts.completeOp(op);
    emitSyncChanged();
    await flush();
    expect(screen.getByTestId('badge').props.children).toBe('synced:0');
  });

  it('an engine error is shown as an error, not as pending, and goes away when it recovers', async () => {
    const { deviceId } = await mockStore.device();
    await record(new LogBuilder('s4', deviceId).accept('p1').build());
    render(<Badge />);
    await flush();
    expect(screen.getByTestId('badge').props.children).toBe('pending:1');

    setEngineStatus({ state: 'error', pending: 1, error: 'denied' });
    await flush();
    expect(screen.getByTestId('badge').props.children).toBe('error:1');

    setEngineStatus({ state: 'pending', pending: 1 });
    await flush();
    expect(screen.getByTestId('badge').props.children).toBe('pending:1');
    setEngineStatus(null);
  });

  it('shows a new write at once, without waiting for the screen to be focused again', async () => {
    const { deviceId } = await mockStore.device();
    render(<Badge />);
    await flush();
    expect(screen.getByTestId('badge').props.children).toBe('synced:0');

    await record(new LogBuilder('s3', deviceId).accept('p1').build());
    emitAppended();
    await flush();
    expect(screen.getByTestId('badge').props.children).toBe('pending:1');
  });
});
