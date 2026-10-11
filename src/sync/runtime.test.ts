import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_GROUP_ID, LogBuilder } from '../core/fixtures';
import { newGroup } from '../core/group';
import { userFromSignIn } from '../core/user';
import { MemoryAccountStore } from '../store/account-memory';
import { MemoryStore } from '../store/memory-store';
import { APPEND_DEBOUNCE_MS } from './engine';
import { FakeRemote } from './fake-remote';
import { startSync } from './runtime';

const somchai = userFromSignIn('user-somchai', 'สมชาย', { provider: 'google', subject: 'g-1' });

/** A tiny event source standing in for the store's append signal and the browser's `online` event. */
function signal() {
  const listeners = new Set<() => void>();
  return {
    on: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    fire: () => listeners.forEach((l) => l()),
    count: () => listeners.size,
  };
}

async function app({ online = true } = {}) {
  const store = new MemoryStore();
  const accounts = new MemoryAccountStore();
  const remote = new FakeRemote();
  const appended = signal();
  const network = signal();
  const foreground = signal();
  let up = online;
  const start = () =>
    startSync({
      scope: { userId: 'user-somchai', groupId: FIXTURE_GROUP_ID },
      store,
      accounts,
      remote,
      onAppended: appended.on,
      onOnline: network.on,
      onForeground: foreground.on,
      isOnline: () => up,
    });
  const { deviceId } = await store.device();
  return { store, accounts, remote, appended, network, foreground, start, deviceId, setOnline: (v: boolean) => (up = v) };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('startSync (E01-S09 wiring)', () => {
  it('on app open sends what was recorded while the app was closed, with no button', async () => {
    const a = await app();
    const { membership, op } = newGroup(FIXTURE_GROUP_ID, 'สวน', somchai, 1);
    await a.accounts.createGroup(membership, op);
    for (const e of new LogBuilder('s1', a.deviceId).accept('p1').accept('p1').build()) await a.store.append(e);

    const handle = a.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(await a.store.pending()).toEqual([]);
    expect(await a.accounts.pendingOps()).toEqual([]);
    expect(a.remote.server.docs.size).toBe(2);
    handle.stop();
  });

  it('does not try while the device knows it is offline, then sends the moment the network returns', async () => {
    const a = await app({ online: false });
    for (const e of new LogBuilder('s1', a.deviceId).accept('p1').build()) await a.store.append(e);
    const handle = a.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(a.remote.calls).toEqual([]);
    expect(await a.store.pending()).toHaveLength(1); // kept, usable, waiting

    a.setOnline(true);
    a.network.fire();
    await vi.advanceTimersByTimeAsync(0);
    expect(await a.store.pending()).toEqual([]);
    expect(a.remote.server.docs.size).toBe(1);
    handle.stop();
  });

  it('sends shortly after a local write, once however many writes follow', async () => {
    const a = await app();
    const handle = a.start();
    await vi.advanceTimersByTimeAsync(0);
    a.remote.calls.length = 0;

    for (const e of new LogBuilder('s1', a.deviceId).accept('p1').accept('p1').accept('p1').build()) {
      await a.store.append(e);
      a.appended.fire();
    }
    await vi.advanceTimersByTimeAsync(APPEND_DEBOUNCE_MS - 1);
    expect(a.remote.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(a.remote.calls).toEqual(['push']);
    expect(a.remote.server.docs.size).toBe(3);
    handle.stop();
  });

  it('a server that is down never reaches the caller: the events stay in the outbox and it retries by itself', async () => {
    const a = await app();
    a.remote.offline = true;
    for (const e of new LogBuilder('s1', a.deviceId).accept('p1').build()) await a.store.append(e);
    const handle = a.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(handle.engine.status()).toMatchObject({ state: 'pending', pending: 1 });

    a.remote.offline = false;
    await vi.advanceTimersByTimeAsync(3_000); // first backoff: 2 s plus up to 1 s jitter
    expect(handle.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
    handle.stop();
  });

  it('coming back to the foreground retries a permanent error by itself, and stop() unsubscribes', async () => {
    const a = await app();
    for (const e of new LogBuilder('s1', a.deviceId).accept('p1').build()) await a.store.append(e);
    a.remote.denied = true;
    const handle = a.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(handle.engine.status()).toMatchObject({ state: 'error', error: 'denied' });

    a.remote.denied = false; // fixed while the app was away
    await vi.advanceTimersByTimeAsync(60_000);
    a.foreground.fire();
    await vi.advanceTimersByTimeAsync(0);
    expect(handle.engine.status()).toMatchObject({ state: 'synced', pending: 0 });

    expect(a.foreground.count()).toBe(1);
    handle.stop();
    expect(a.foreground.count()).toBe(0);
  });

  it('stop() leaves nothing listening and cancels pending retries', async () => {
    const a = await app();
    a.remote.offline = true;
    for (const e of new LogBuilder('s1', a.deviceId).accept('p1').build()) await a.store.append(e);
    const handle = a.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(a.appended.count()).toBe(1);
    expect(a.network.count()).toBe(1);

    handle.stop();
    handle.stop(); // idempotent
    expect(a.appended.count()).toBe(0);
    expect(a.network.count()).toBe(0);
    a.remote.offline = false;
    a.remote.calls.length = 0;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(a.remote.calls).toEqual([]);
  });
});
