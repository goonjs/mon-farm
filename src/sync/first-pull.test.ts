import { describe, expect, it } from 'vitest';

import { firstPullGate, GRACE_MS, type GateInput } from './first-pull';

const base: GateInput = { mode: 'on', cursor: 0, groupOnlyHere: false, online: true, syncError: false, elapsedMs: 0 };
const gate = (over: Partial<GateInput>) => firstPullGate({ ...base, ...over }).kind;

describe('firstPullGate (points wizard)', () => {
  it('a build that does not sync never waits', () => {
    expect(gate({ mode: 'off' })).toBe('ready');
  });

  it('online and trying, within the grace period: waits', () => {
    expect(gate({ mode: 'connecting' })).toBe('waiting');
    expect(gate({ elapsedMs: GRACE_MS - 1 })).toBe('waiting');
  });

  it('the first completed pull lets it through, for good', () => {
    expect(gate({ cursor: 1 })).toBe('ready');
    expect(gate({ cursor: 1_790_000_000_000, syncError: true, online: false })).toBe('ready');
  });

  it('a brand-new group that exists only on this device has nobody to duplicate: ready at once, even offline', () => {
    expect(gate({ groupOnlyHere: true, online: false })).toBe('ready');
    expect(gate({ groupOnlyHere: true, mode: 'connecting' })).toBe('ready');
  });

  it('offline first launch: never a trap — unavailable at once, said as offline', () => {
    expect(firstPullGate({ ...base, online: false })).toEqual({ kind: 'unavailable', reason: 'offline' });
  });

  it('sync in an error state (denied rules, missing database, refusal): unavailable at once, said as an error', () => {
    expect(firstPullGate({ ...base, syncError: true })).toEqual({ kind: 'unavailable', reason: 'error' });
  });

  it('still no first pull after the grace period (a hung connection, no Firebase session): unavailable', () => {
    expect(firstPullGate({ ...base, elapsedMs: GRACE_MS })).toEqual({ kind: 'unavailable', reason: 'error' });
    expect(firstPullGate({ ...base, mode: 'connecting', elapsedMs: GRACE_MS + 1 })).toEqual({ kind: 'unavailable', reason: 'error' });
  });
});
