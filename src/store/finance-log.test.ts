/**
 * E01-S28 round 2 · the finance log moves into the one `EventStore` (S28-AC1, AC5–AC8):
 * `EventFinanceStore` is the thin port over it, the old log is copied in once and kept.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { canonicalJson } from '../core/canonical';
import { APP_MIN_KIND, APP_RELEASE, FINANCE_SCOPE, appBelowMin, minAppOf } from '../core/finance-scope';
import { projectFinance } from '../core/finance/ledger';
import type { FinanceEvent } from '../core/finance/types';
import { FIXTURE_GROUP_ID, financeSamples, legacyFinance } from '../core/fixtures';
import { waitingCount } from '../core/scope';
import type { SaleEvent } from '../core/types';
import { createDeviceClock } from './device-clock';
import { MemoryFinanceStore } from './finance-memory';
import { EventFinanceStore, FINANCE_MIGRATED_FLAG, ensureAppMin, migrateFinanceLog, toFinanceEvent } from './finance-log';
import { MemoryStore } from './memory-store';

const SCOPE = { userId: 'user-somchai', groupId: FIXTURE_GROUP_ID };

/** A device: its event store, clock, the old finance log, and the port over both. */
async function device(legacy = new MemoryFinanceStore(), scope: (() => typeof SCOPE | null) = () => SCOPE) {
  const events = new MemoryStore();
  const clock = createDeviceClock(events);
  const deviceId = await clock.load();
  const finance = new EventFinanceStore(events, clock, legacy, scope);
  return { events, clock, deviceId, legacy, finance };
}

const expense = (amountSatang: number) => ({ t: 'expense_created', fields: { ...(financeSamples().expense_created as { fields: object }).fields, amountSatang } }) as FinanceEvent['payload'];
const strip = (e: FinanceEvent) => ({ ...e, deviceSeq: 0 });

describe('APP_RELEASE (S28 round 2)', () => {
  it('is 2: round-1 builds (release 1) ask for an update once the group minimum is written', () => {
    expect(APP_RELEASE).toBe(2);
    expect(appBelowMin([{ kind: APP_MIN_KIND, payload: { minApp: APP_RELEASE } } as unknown as SaleEvent], 1)).toBe(true);
  });
});

describe('EventFinanceStore — writes go to the EventStore (S28-AC1)', () => {
  it("stores a finance event as kind 'finance' under FINANCE_SCOPE, targetId/baseEventId/payload unchanged", async () => {
    const d = await device();
    const e = legacyFinance('f1', expense(65_000), { targetId: 'x1', base: null, deviceId: d.deviceId });
    await d.finance.append(e);
    const stored = (await d.events.load(FINANCE_SCOPE)).filter((s) => s.kind === 'finance');
    expect(stored).toHaveLength(1);
    const [s] = stored as (SaleEvent & { targetId: string; baseEventId: string | null; payload: unknown })[];
    expect(s).toMatchObject({ id: 'f1', kind: 'finance', saleId: FINANCE_SCOPE, groupId: e.groupId, actor: e.actor, ts: e.ts, source: 'app' });
    expect(s.targetId).toBe('x1');
    expect(s.baseEventId).toBeNull();
    expect(canonicalJson(s.payload)).toBe(canonicalJson(e.payload));
    expect(typeof s.seq).toBe('number');
    expect(typeof s.mono).toBe('number');
  });

  it('a finance write is in the outbox (pending) and is not a sale', async () => {
    const d = await device();
    await d.finance.append(legacyFinance('f1', expense(65_000), { deviceId: d.deviceId }));
    expect((await d.events.pending()).map((e) => e.id)).toContain('f1');
    expect(await d.events.listSales()).toEqual([]);
  });

  it('load() returns the finance events as FinanceEvent, without the app_min event', async () => {
    const d = await device();
    const e = legacyFinance('f1', expense(65_000), { targetId: 'x1', deviceId: d.deviceId });
    await d.finance.append(e);
    const back = await d.finance.load();
    expect(back.map(strip)).toEqual([strip(e)]);
    expect(Object.keys(back[0]).sort()).toEqual(Object.keys(e).sort());
  });

  it('the same id twice is a no-op; the same id with other content is refused', async () => {
    const d = await device();
    const e = legacyFinance('f1', expense(65_000), { deviceId: d.deviceId });
    await d.finance.append(e);
    await d.finance.append(e);
    expect(await d.finance.load()).toHaveLength(1);
    await expect(d.finance.append({ ...e, payload: financeSamples().category_added })).rejects.toThrow();
  });

  it('never writes to the old finance log (S28-AC7)', async () => {
    const legacy = new MemoryFinanceStore();
    const spy = vi.spyOn(legacy, 'append');
    const d = await device(legacy);
    await d.finance.append(legacyFinance('f1', expense(65_000), { deviceId: d.deviceId }));
    expect(spy).not.toHaveBeenCalled();
    expect(await legacy.load()).toEqual([]);
  });
});

describe("the group minimum: one 'app_min' event before the first finance event (story schema section)", () => {
  it('is written with minApp = APP_RELEASE, before the first finance event in outbox order', async () => {
    const d = await device();
    await d.finance.append(legacyFinance('f1', expense(65_000), { deviceId: d.deviceId }));
    const outbox = await d.events.pending();
    expect(outbox.map((e) => e.kind)).toEqual(['app_min', 'finance']);
    expect(outbox[0]).toMatchObject({ saleId: FINANCE_SCOPE, groupId: SCOPE.groupId, actor: { userId: SCOPE.userId, deviceId: d.deviceId }, payload: { minApp: APP_RELEASE } });
    expect(minAppOf(await d.events.load(FINANCE_SCOPE))).toBe(APP_RELEASE);
  });

  it('is written once per group, not once per write', async () => {
    const d = await device();
    await d.finance.append(legacyFinance('f1', expense(65_000), { deviceId: d.deviceId }));
    await d.finance.append(legacyFinance('f2', expense(1_000), { deviceId: d.deviceId }));
    expect((await d.events.load(FINANCE_SCOPE)).filter((e) => e.kind === 'app_min')).toHaveLength(1);
  });

  it('is not written again when the group already has one at this release (pulled from another phone)', async () => {
    const d = await device();
    const other = { id: 'm-other', groupId: SCOPE.groupId, saleId: FINANCE_SCOPE, seq: 1, deviceSeq: 1, ts: 1, mono: 1, actor: { userId: 'user-other', deviceId: 'dev-B' }, source: 'app', kind: 'app_min', payload: { minApp: APP_RELEASE } } as SaleEvent;
    await d.events.insertPulled(other);
    expect(await ensureAppMin(d.events, d.clock, SCOPE)).toBe(false);
    await d.finance.append(legacyFinance('f1', expense(65_000), { deviceId: d.deviceId }));
    expect((await d.events.load(FINANCE_SCOPE)).filter((e) => e.kind === 'app_min').map((e) => e.id)).toEqual(['m-other']);
  });

  it('is written for a group that has only a lower minimum', async () => {
    const d = await device();
    const old = { id: 'm-1', groupId: SCOPE.groupId, saleId: FINANCE_SCOPE, seq: 1, deviceSeq: 1, ts: 1, mono: 1, actor: { userId: 'user-other', deviceId: 'dev-B' }, source: 'app', kind: 'app_min', payload: { minApp: 1 } } as SaleEvent;
    await d.events.insertPulled(old);
    expect(await ensureAppMin(d.events, d.clock, SCOPE)).toBe(true);
    expect(minAppOf(await d.events.load(FINANCE_SCOPE))).toBe(APP_RELEASE);
  });

  it("another group's minimum does not count for this group", async () => {
    const d = await device();
    const elsewhere = { id: 'm-g2', groupId: 'group-2', saleId: FINANCE_SCOPE, seq: 1, deviceSeq: 1, ts: 1, mono: 1, actor: { userId: 'user-other', deviceId: 'dev-B' }, source: 'app', kind: 'app_min', payload: { minApp: APP_RELEASE } } as SaleEvent;
    await d.events.insertPulled(elsewhere);
    expect(await ensureAppMin(d.events, d.clock, SCOPE)).toBe(true);
  });
});

/** A small old log of real records: an expense edited twice on one base (a conflict), a debt, its payment, a repayment. */
function oldLog(deviceId: string): FinanceEvent[] {
  const s = financeSamples();
  return [
    legacyFinance('o1', s.expense_created, { targetId: 'x1', deviceSeq: 1, deviceId }),
    legacyFinance('o2', { t: 'expense_changed', patch: { amountSatang: 70_000 } }, { targetId: 'x1', base: 'o1', deviceSeq: 2, deviceId }),
    legacyFinance('o3', { t: 'expense_changed', patch: { amountSatang: 80_000 } }, { targetId: 'x1', base: 'o1', deviceSeq: 3, deviceId, ts: 1_770_000_000_001 }),
    legacyFinance('o4', s.debt_added, { targetId: 'd1', deviceSeq: 4, deviceId }),
    legacyFinance('o5', s.debt_payment_recorded, { targetId: 'dp1', deviceSeq: 5, deviceId }),
    legacyFinance('o6', s.category_added, { targetId: 'c1', deviceSeq: 6, deviceId }),
    legacyFinance('o7', s.sale_rounding_set, { targetId: 'sale-rounding-sale-1', deviceSeq: 7, deviceId }),
  ];
}

async function legacyWith(events: readonly FinanceEvent[]) {
  const legacy = new MemoryFinanceStore();
  for (const e of events) await legacy.append(e);
  return legacy;
}

describe('the one-time copy of the old finance log (S28-AC5, AC6, AC7)', () => {
  it('copies every old event once: ids and fields unchanged except deviceSeq, totals equal to the satang', async () => {
    const legacy = new MemoryFinanceStore();
    const d = await device(legacy);
    // Written by this install before the move.
    const log = oldLog(d.deviceId);
    for (const e of log) await legacy.append(e);
    const result = await migrateFinanceLog(d.events, legacy);
    expect(result).toEqual({ copied: log.length, skipped: 0, refused: 0 });
    const back = await d.finance.load();
    expect(back.map(strip).sort((a, b) => a.id.localeCompare(b.id))).toEqual(log.map(strip));
    expect(canonicalJson(projectFinance(back))).toBe(canonicalJson(projectFinance(log)));
  });

  it('runs on first use of the port and leaves the "copied" marker in the store meta', async () => {
    const log = oldLog('dev-old');
    const legacy = await legacyWith(log);
    const d = await device(legacy);
    expect(await d.events.metaValue(FINANCE_MIGRATED_FLAG)).toBeNull();
    expect(await d.finance.load()).toHaveLength(log.length);
    // The marker keeps how long the old log was, so a longer one is copied again (review N2).
    expect(JSON.parse((await d.events.metaValue(FINANCE_MIGRATED_FLAG))!)).toEqual({ count: log.length });
  });

  it('stopped half-way and run again: ids already in the store are skipped, no repeat, no error', async () => {
    const legacy = new MemoryFinanceStore();
    const d = await device(legacy);
    const log = oldLog(d.deviceId);
    for (const e of log) await legacy.append(e);
    // The first run got three events in, then the app was closed.
    const real = d.events.append.bind(d.events);
    let n = 0;
    const cut = vi.spyOn(d.events, 'append').mockImplementation(async (e) => {
      if (++n > 3) throw new Error('closed');
      return real(e);
    });
    await expect(migrateFinanceLog(d.events, legacy)).rejects.toThrow('closed');
    cut.mockRestore();
    expect(await d.events.metaValue(FINANCE_MIGRATED_FLAG)).toBeNull();
    const again = await migrateFinanceLog(d.events, legacy);
    expect(again).toEqual({ copied: log.length - 3, skipped: 3, refused: 0 });
    const twice = await migrateFinanceLog(d.events, legacy);
    expect(twice).toEqual({ copied: 0, skipped: log.length, refused: 0 });
    expect((await d.events.load(FINANCE_SCOPE)).filter((e) => e.kind === 'finance')).toHaveLength(log.length);
    expect(JSON.parse((await d.events.metaValue(FINANCE_MIGRATED_FLAG))!)).toEqual({ count: log.length });
  });

  it('with the marker set and the old log unchanged, nothing is copied again', async () => {
    const legacy = await legacyWith(oldLog('dev-A'));
    const d = await device(legacy);
    await d.finance.load();
    const spy = vi.spyOn(d.events, 'append');
    const d2 = new EventFinanceStore(d.events, d.clock, legacy, () => SCOPE);
    await d2.load();
    await d.finance.load();
    expect(spy).not.toHaveBeenCalled();
  });

  // Review N2: a round-1 tab still open in the same browser keeps writing the old log after the copy.
  it('an old log that grew after the copy is copied again, on the next read, without repeats', async () => {
    const log = oldLog('dev-A');
    const legacy = await legacyWith(log);
    const d = await device(legacy);
    expect(await d.finance.load()).toHaveLength(log.length);
    await legacy.append(legacyFinance('late', financeSamples().category_added, { targetId: 'c-late', deviceId: 'dev-A' }));
    const ids = (await d.finance.load()).map((e) => e.id);
    expect(ids).toContain('late');
    expect(ids).toHaveLength(log.length + 1);
    expect(JSON.parse((await d.events.metaValue(FINANCE_MIGRATED_FLAG))!)).toEqual({ count: log.length + 1 });
  });

  // Review N7: one bad old row must not stop every money save.
  it('a malformed old row is skipped and logged; the rest is copied and money can still be saved', async () => {
    const legacy = new MemoryFinanceStore();
    const bad = { id: 'broken', groupId: FIXTURE_GROUP_ID, payload: { t: 'category_added', name: 'x' } } as unknown as FinanceEvent;
    vi.spyOn(legacy, 'load').mockResolvedValue([bad, legacyFinance('ok', financeSamples().category_added, { targetId: 'c9' })]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const d = await device(legacy);
    expect(await migrateFinanceLog(d.events, legacy)).toEqual({ copied: 1, skipped: 0, refused: 1 });
    expect(warn).toHaveBeenCalled();
    await d.finance.append(legacyFinance('new-1', financeSamples().category_added, { targetId: 'c10', deviceId: d.deviceId }));
    expect((await d.finance.load()).map((e) => e.id).sort()).toEqual(['new-1', 'ok']);
  });

  it('keeps the old log as it was (never deleted)', async () => {
    const log = oldLog('dev-A');
    const legacy = await legacyWith(log);
    const d = await device(legacy);
    await d.finance.load();
    expect(await legacy.load()).toEqual(log);
  });

  it('writes the group minimum for the signed-in scope before the copied events, so it is sent first', async () => {
    const legacy = new MemoryFinanceStore();
    const d = await device(legacy);
    for (const e of oldLog(d.deviceId)) await legacy.append(e);
    await d.finance.load();
    const outbox = await d.events.pending();
    expect(outbox[0].kind).toBe('app_min');
  });

  it('with no one signed in it copies, and writes no minimum (nothing can be sent yet)', async () => {
    const legacy = await legacyWith(oldLog('dev-A'));
    const d = await device(legacy, () => null);
    expect(await d.finance.load()).toHaveLength(oldLog('dev-A').length);
    expect((await d.events.load(FINANCE_SCOPE)).some((e) => e.kind === 'app_min')).toBe(false);
  });
});

describe('scope of copied events (S28-AC8, rule of E01-S09)', () => {
  it("another user's and another group's events are copied, but are not waiting to be sent, and only this group's count", async () => {
    const s = financeSamples();
    const legacy = await legacyWith([
      legacyFinance('mine', s.category_added, { targetId: 'c1' }),
      legacyFinance('theirs', s.category_added, { targetId: 'c2', userId: 'user-other' }),
      legacyFinance('elsewhere', s.category_added, { targetId: 'c3', groupId: 'group-2' }),
    ]);
    const d = await device(legacy);
    // Review N6: the money screens add up only the open group's money ('elsewhere' is group-2's).
    expect((await d.finance.load()).map((e) => e.id).sort()).toEqual(['mine', 'theirs']);
    const pending = await d.events.pending();
    expect(pending.map((e) => e.id)).toEqual(expect.arrayContaining(['mine', 'theirs', 'elsewhere']));
    // Only this user's money in this group waits to be sent (the minimum is not counted, review N8).
    expect(waitingCount(SCOPE, pending, [])).toBe(1);
  });

  it('an old event with no groupId is left in the old log: not copied, not counted, not deleted', async () => {
    const legacy = new MemoryFinanceStore();
    const bare = { ...legacyFinance('bare', financeSamples().category_added), groupId: '' } as FinanceEvent;
    // The old log refuses it now too; one written before groups existed is read back as is.
    vi.spyOn(legacy, 'load').mockResolvedValue([bare, legacyFinance('ok', financeSamples().category_added, { targetId: 'c9' })]);
    const d = await device(legacy);
    const result = await migrateFinanceLog(d.events, legacy);
    expect(result).toEqual({ copied: 1, skipped: 0, refused: 1 });
    expect((await d.finance.load()).map((e) => e.id)).toEqual(['ok']);
  });
});

describe('toFinanceEvent', () => {
  // Review B1: a round-1 tab's `fromEnvelope` dropped `baseEventId: null` and a `targetId` equal to the id.
  it("reads a round-1 tab's copy (no baseEventId, no targetId) as a create of its own record", () => {
    const e = legacyFinance('f9', financeSamples().category_added, { targetId: 'f9' });
    const roundOne = { ...e, kind: 'finance', saleId: FINANCE_SCOPE, seq: 1, mono: 1 } as Record<string, unknown>;
    delete roundOne.baseEventId;
    delete roundOne.targetId;
    expect(toFinanceEvent(roundOne as unknown as Parameters<typeof toFinanceEvent>[0])).toEqual(e);
  });

  it('drops the envelope-only fields (saleId, seq, mono, kind)', () => {
    const e = legacyFinance('f1', financeSamples().category_added, { targetId: 'c1' });
    const stored = { ...e, kind: 'finance', saleId: FINANCE_SCOPE, seq: 4, mono: 9 } as unknown as Parameters<typeof toFinanceEvent>[0];
    expect(toFinanceEvent(stored)).toEqual(e);
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
});
