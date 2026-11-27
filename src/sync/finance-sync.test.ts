/**
 * E01-S28 round 2 · money through the sync engine, two phones and a fake server that round-trips every
 * document through the Firestore envelope: sent on its own (AC2), pulled by the other phone (AC3), a
 * conflict raised and resolved on both (AC9), finance events that name a sale arriving before or after
 * that sale (AC11).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FINANCE_SCOPE } from '../core/finance-scope';
import { projectDebts } from '../core/finance/debts';
import { projectFinance } from '../core/finance/ledger';
import { paymentStatus } from '../core/finance/payments';
import { roundingFor } from '../core/finance/rounding';
import { FARM_FUNDS, type FinanceEvent, type FinancePayload } from '../core/finance/types';
import { FIXTURE_GROUP_ID, LogBuilder } from '../core/fixtures';
import { projectSale } from '../core/project';
import type { SaleEvent } from '../core/types';
import { MemoryAccountStore } from '../store/account-memory';
import { createDeviceClock } from '../store/device-clock';
import { MemoryFinanceStore } from '../store/finance-memory';
import { EventFinanceStore } from '../store/finance-log';
import { MemoryStore } from '../store/memory-store';
import { MemoryCursor, SyncEngine } from './engine';
import { FakeRemote, FakeServer } from './fake-remote';
import { fromEnvelope, toEnvelope } from './firestore-remote';

/** The server keeps what the envelope carries, nothing more: a lossy mapping would show here. */
class EnvelopeRemote extends FakeRemote {
  override async push(events: readonly SaleEvent[]): Promise<void> {
    return super.push(events.map((e) => fromEnvelope({ ...toEnvelope(e), receivedAt: 0 })));
  }
}

let n = 0;
const nextId = (who: string) => `${who}-${String(++n).padStart(4, '0')}`;

async function phone(userId: string, server: FakeServer) {
  const store = new MemoryStore();
  const clock = createDeviceClock(store);
  const deviceId = await clock.load();
  const scope = { userId, groupId: FIXTURE_GROUP_ID };
  const finance = new EventFinanceStore(store, clock, new MemoryFinanceStore(), () => scope);
  const remote = new EnvelopeRemote(server);
  const engine = new SyncEngine({ store, accounts: new MemoryAccountStore(), scope, remote, cursor: new MemoryCursor(), random: () => 0 });
  /** What `writeFinance` does, with this phone's identity. */
  const write = async (targetId: string, baseEventId: string | null, payload: FinancePayload): Promise<FinanceEvent> => {
    const event: FinanceEvent = { id: nextId(userId), groupId: scope.groupId, deviceSeq: clock.take(), ts: Date.now(), actor: { userId, deviceId }, source: 'app', targetId, baseEventId, payload };
    await finance.append(event);
    return event;
  };
  return { store, clock, deviceId, scope, finance, remote, engine, write };
}

const RED = { id: 'p-red', name: 'แดง' };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('money is sent on its own and reaches the other phone (S28-AC2, AC3)', () => {
  it('an expense recorded offline waits in the outbox, goes up when online, and phone B sees it', async () => {
    const server = new FakeServer();
    const a = await phone('user-a', server);
    const b = await phone('user-b', server);
    a.remote.offline = true;
    await a.write('x1', null, { t: 'expense_created', fields: { amountSatang: 65_000, date: '2026-11-20', stage: 'actual', categoryId: null, propertyId: null, item: 'ค่าไฟ', note: '', payer: null } });
    await a.engine.sync();
    expect(a.engine.status()).toMatchObject({ state: 'pending', pending: 2 }); // the minimum + the expense

    a.remote.offline = false;
    await a.engine.sync();
    expect(await a.store.pending()).toEqual([]);
    expect([...server.docs.values()].map((d) => d.event.kind).sort()).toEqual(['app_min', 'finance']);

    await b.engine.sync();
    const seen = projectFinance(await b.finance.load()).expenses;
    expect(seen.map((x) => [x.id, x.amountSatang])).toEqual([['x1', 65_000]]);
    // Pulled money is not in B's outbox and the finance scope is not a sale on B.
    expect(await b.store.pending()).toEqual([]);
    expect(await b.store.listSales()).toEqual([]);
  });

  it('an ack lost on the way: sent again, the server keeps one copy, the outbox empties', async () => {
    const server = new FakeServer();
    const a = await phone('user-a', server);
    await a.write('c1', null, { t: 'category_added', name: 'ค่าไฟ' });
    a.remote.loseNextAck();
    await a.engine.sync();
    expect(a.engine.status().state).toBe('pending');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(server.docs.size).toBe(2);
    expect(await a.store.pending()).toEqual([]);
    expect(a.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
  });

  it("phone A's own money comes back on pull unchanged (no integrity error)", async () => {
    const server = new FakeServer();
    const a = await phone('user-a', server);
    await a.write('x1', null, { t: 'category_added', name: 'ค่าน้ำ' });
    await a.engine.sync();
    await a.engine.sync();
    expect(a.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
    expect(await a.finance.load()).toHaveLength(1);
  });
});

describe('two phones edit the same expense on the same base (S28-AC9, D-30)', () => {
  it('both show the conflict with the value from before; resolving on one clears it on both', async () => {
    const server = new FakeServer();
    const a = await phone('user-a', server);
    const b = await phone('user-b', server);
    const created = await a.write('x1', null, { t: 'expense_created', fields: { amountSatang: 64_000, date: '2026-11-20', stage: 'actual', categoryId: null, propertyId: null, item: 'ปุ๋ย', note: '', payer: null } });
    await a.engine.sync();
    await b.engine.sync();

    a.remote.offline = true;
    b.remote.offline = true;
    const ea = await a.write('x1', created.id, { t: 'expense_changed', patch: { amountSatang: 70_000 } });
    const eb = await b.write('x1', created.id, { t: 'expense_changed', patch: { amountSatang: 65_000 } });
    a.remote.offline = false;
    b.remote.offline = false;
    await a.engine.sync();
    await b.engine.sync();
    await a.engine.sync();

    for (const p of [a, b]) {
      const [x] = projectFinance(await p.finance.load()).expenses;
      expect(x.amountSatang).toBe(64_000);
      expect(x.conflicts).toEqual([{ field: 'amountSatang', values: [65_000, 70_000] }]);
    }

    // Resolved on A: one edit naming every head.
    await a.write('x1', ea.id, { t: 'expense_changed', patch: { amountSatang: 70_000 }, alsoBasedOn: [eb.id] });
    await a.engine.sync();
    await b.engine.sync();
    for (const p of [a, b]) {
      const [x] = projectFinance(await p.finance.load()).expenses;
      expect(x.conflicts).toEqual([]);
      expect(x.amountSatang).toBe(70_000);
    }
  });
});

describe('finance events that name a sale, in either order with the sale (S28-AC11)', () => {
  it('money before the sale: nothing breaks; once the sale is there, and later deleted, the totals follow', async () => {
    const server = new FakeServer();
    const a = await phone('user-a', server);
    const b = await phone('user-b', server);
    await a.write('debt-red', null, { t: 'debt_added', fields: { worker: RED, kind: 'loan', amountSatang: 600_000, date: '2026-11-01', note: '', lender: FARM_FUNDS_PAYER, fertilizer: null, carriedForward: false } });
    await a.write('dp-red', null, { t: 'debt_payment_recorded', fields: { worker: RED, creditor: FARM_FUNDS_PAYER, amountSatang: 100_000, date: '2026-11-20', note: '', method: 'cash-from-share', saleId: 'sale-1' } });
    await a.write('sale-rounding-sale-1', null, { t: 'sale_rounding_set', saleId: 'sale-1', mode: 'owner' });
    await a.write('payment-sale-1-owner', null, { t: 'payment_mark_set', saleId: 'sale-1', payee: 'owner', done: true, amountSatang: 1_000_000 });
    await a.engine.sync();
    await b.engine.sync();

    // B has the money, not the sale yet.
    const counts = async () => {
      const gone = new Set<string>();
      for (const id of await b.store.listSales()) if (projectSale(await b.store.load(id), id).deleted) gone.add(id);
      return (id: string) => !gone.has(id);
    };
    let fin = await b.finance.load();
    expect(await b.store.listSales()).toEqual([]);
    const none = await b.store.load('sale-1');
    expect(() => projectSale(none, 'sale-1')).not.toThrow();
    expect(projectDebts(fin, await counts()).get(RED.id)?.balanceSatang).toBe(500_000);
    expect(roundingFor(fin, 'sale-1', b.deviceId).mode).toBe('owner');
    expect(paymentStatus(fin, 'sale-1', 'owner', 1_000_000).done).toBe(true);

    // The sale arrives.
    for (const e of new LogBuilder('sale-1', a.deviceId).sys({ t: 'sale_started', farmName: 'สวน', buyer: 'ร้าน', manager: 'ก', workerLead: 'ข', where: 'farm' }).accept('p1').build()) {
      await a.store.append({ ...e, actor: { userId: 'user-a', deviceId: a.deviceId } });
    }
    await a.engine.sync();
    await b.engine.sync();
    expect(await b.store.listSales()).toEqual(['sale-1']);
    fin = await b.finance.load();
    expect(projectDebts(fin, await counts()).get(RED.id)?.balanceSatang).toBe(500_000);

    // The sale is deleted on A: the deduction made at it stops counting on B (D-67).
    const [del] = new LogBuilder('sale-1', a.deviceId).remove('sale-1').build();
    await a.store.append({ ...del, seq: 99, actor: { userId: 'user-a', deviceId: a.deviceId } });
    await a.engine.sync();
    await b.engine.sync();
    expect(projectDebts(await b.finance.load(), await counts()).get(RED.id)?.balanceSatang).toBe(600_000);
  });

  it('the sale before its money: the sale projects alone, then the money joins', async () => {
    const server = new FakeServer();
    const a = await phone('user-a', server);
    const b = await phone('user-b', server);
    for (const e of new LogBuilder('sale-2', a.deviceId).sys({ t: 'sale_started', farmName: 'สวน', buyer: 'ร้าน', manager: 'ก', workerLead: 'ข', where: 'farm' }).build()) {
      await a.store.append({ ...e, actor: { userId: 'user-a', deviceId: a.deviceId } });
    }
    await a.engine.sync();
    await b.engine.sync();
    expect(paymentStatus(await b.finance.load(), 'sale-2', 'owner', 10).done).toBe(false);

    await a.write('payment-sale-2-owner', null, { t: 'payment_mark_set', saleId: 'sale-2', payee: 'owner', done: true, amountSatang: 10 });
    await a.engine.sync();
    await b.engine.sync();
    expect(paymentStatus(await b.finance.load(), 'sale-2', 'owner', 10).done).toBe(true);
    expect((await b.store.load(FINANCE_SCOPE)).length).toBeGreaterThan(0);
    expect(await b.store.listSales()).toEqual(['sale-2']);
  });
});

const FARM_FUNDS_PAYER = { id: FARM_FUNDS, name: 'เงินฟาร์ม' };

