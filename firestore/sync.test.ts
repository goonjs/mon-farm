/**
 * The sync engine against the real Firestore SDK and the real rules, on the
 * emulator (E01-S09):
 *
 *   npm run test:rules   (firebase emulators:exec --only firestore …)
 *
 * Each "phone" is its own event store, account store and engine; the server
 * is the emulator. Nothing here touches a real Firebase project.
 */

import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, disableNetwork, doc, enableNetwork, getDoc, getDocs, setDoc, setLogLevel, type Firestore } from 'firebase/firestore';

import { newGroup } from '../src/core/group';
import { MASTER_SCOPE } from '../src/core/master';
import type { AcceptEvent, GroupId, MasterEvent, SaleEvent } from '../src/core/types';
import { userFromSignIn } from '../src/core/user';
import { uuidv7 } from '../src/lib/id';
import { MemoryAccountStore } from '../src/store/account-memory';
import { MemoryStore } from '../src/store/memory-store';
import { MemoryCursor, SyncEngine } from '../src/sync/engine';
import { FirestoreRemote, type DocWrite, type FirestoreLayer } from '../src/sync/firestore-remote';
import { sdkLayer } from '../src/sync/firestore-sdk';

// The refusals these tests provoke are logged by the SDK; they are the point, not news.
setLogLevel('silent');

const GID: GroupId = 'farm-1';
const SALE = 'sale-1';

let env: RulesTestEnvironment;
const engines: SyncEngine[] = [];

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mon-farm',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterEach(() => {
  // A transient failure leaves a retry timer behind.
  for (const e of engines.splice(0)) e.stop();
});

/** Makes `uid` a member of `GID` without going through the app (the invite function is not built). */
async function seedMember(uid: string, gid: GroupId = GID) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    await setDoc(doc(admin, `groups/${gid}`), { name: gid, createdBy: 'seed', createdAt: 0, memberCount: 2 }, { merge: true });
    await setDoc(doc(admin, `groups/${gid}/members/${uid}`), { uid, role: 'owner' });
  });
}

const basket = (userId: string, deviceId: string, deviceSeq: number, groupId: GroupId = GID): AcceptEvent => ({
  id: uuidv7(),
  groupId,
  saleId: SALE,
  seq: deviceSeq,
  deviceSeq,
  ts: 1_790_000_000_000 + deviceSeq,
  mono: deviceSeq * 1_000,
  actor: { userId, deviceId },
  source: 'app',
  kind: 'accept',
  pileId: 'p1',
  input: 'hold',
  netG: 50_000,
  tareG: 2_000,
});

interface PhoneOptions {
  readonly groupId?: GroupId;
  readonly wrap?: (layer: FirestoreLayer) => FirestoreLayer;
  readonly ackTimeoutMs?: number;
  readonly pullPageSize?: number;
}

/** One phone, signed in as `uid`, talking to the emulator as that user. */
async function phone(uid: string, { groupId = GID, wrap = (l) => l, ackTimeoutMs, pullPageSize }: PhoneOptions = {}) {
  // The test kit types its instance as the compat one; at runtime it is the modular SDK's.
  const db = env.authenticatedContext(uid).firestore() as unknown as Firestore;
  const store = new MemoryStore();
  const accounts = new MemoryAccountStore();
  const { deviceId } = await store.device();
  const remote = new FirestoreRemote(wrap(sdkLayer(db)), groupId, uid);
  const engine = new SyncEngine({
    store,
    accounts,
    scope: { userId: uid, groupId },
    remote,
    cursor: new MemoryCursor(),
    random: () => 0,
    ackTimeoutMs,
    pullPageSize,
  });
  engines.push(engine);
  const record = async (...events: SaleEvent[]) => {
    for (const e of events) await store.append(e);
  };
  return { db, store, accounts, engine, deviceId, record, uid };
}

type Phone = Awaited<ReturnType<typeof phone>>;

const idsOf = async (p: Phone) => (await p.store.load(SALE)).map((e) => e.id).sort();
const serverIds = async (gid: GroupId = GID) => {
  let ids: string[] = [];
  await env.withSecurityRulesDisabled(async (ctx) => {
    ids = (await getDocs(collection(ctx.firestore(), `groups/${gid}/events`))).docs.map((d) => d.id).sort();
  });
  return ids;
};

describe('two phones, one group (SYNC-4)', () => {
  it('different baskets recorded offline on each phone are all on both after sync', async () => {
    await seedMember('alice');
    await seedMember('bob');
    const alice = await phone('alice');
    const bob = await phone('bob');
    const a = [basket('alice', alice.deviceId, 1), basket('alice', alice.deviceId, 2)];
    const b = [basket('bob', bob.deviceId, 1), basket('bob', bob.deviceId, 2), basket('bob', bob.deviceId, 3)];
    await alice.record(...a);
    await bob.record(...b);

    await alice.engine.sync();
    await bob.engine.sync();
    await alice.engine.sync(); // Alice pulls Bob's baskets

    const all = [...a, ...b].map((e) => e.id).sort();
    expect(await serverIds()).toEqual(all);
    expect(await idsOf(alice)).toEqual(all);
    expect(await idsOf(bob)).toEqual(all);
    expect(await alice.store.pending()).toEqual([]);
    expect(await bob.store.pending()).toEqual([]);
    expect(alice.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
    expect(bob.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
  });

  it('what comes back is byte-for-byte the event that went up, and pulling again adds nothing', async () => {
    await seedMember('alice');
    await seedMember('bob');
    const alice = await phone('alice');
    const bob = await phone('bob');
    const e = basket('alice', alice.deviceId, 1);
    await alice.record(e);
    await alice.engine.sync();

    await bob.engine.sync();
    await bob.engine.sync();
    expect(await bob.store.load(SALE)).toEqual([e]);
    expect(await bob.store.pending()).toEqual([]);
  });

  it('stamps receivedAt from the server clock, not the phone', async () => {
    await seedMember('alice');
    const alice = await phone('alice');
    const e = { ...basket('alice', alice.deviceId, 1), ts: 1 };
    await alice.record(e);
    await alice.engine.sync();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const data = (await getDoc(doc(ctx.firestore(), `groups/${GID}/events/${e.id}`))).data()!;
      expect(data.receivedAt.toMillis()).toBeGreaterThan(1_700_000_000_000);
      expect(data.ts).toBe(1);
    });
  });
});

describe('re-sending is idempotent', () => {
  /** The server commits the batch, but the phone never hears: the commonest real failure. */
  const loseFirstAck = (layer: FirestoreLayer): FirestoreLayer => {
    let lost = false;
    return {
      ...layer,
      async commit(writes: readonly DocWrite[]) {
        await layer.commit(writes);
        if (!lost) {
          lost = true;
          throw Object.assign(new Error('ack lost'), { code: 'unavailable' });
        }
      },
    };
  };

  it('an ack lost in transit: the retry finds its events already there, sends nothing twice, and empties the outbox', async () => {
    await seedMember('alice');
    const alice = await phone('alice', { wrap: loseFirstAck });
    const events = [basket('alice', alice.deviceId, 1), basket('alice', alice.deviceId, 2)];
    await alice.record(...events);

    await alice.engine.sync();
    expect(alice.engine.status()).toMatchObject({ state: 'pending', pending: 2 });
    expect(await serverIds()).toHaveLength(2); // it did get there

    await alice.engine.sync();
    expect(alice.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
    expect(await alice.store.pending()).toEqual([]);
    expect(await serverIds()).toEqual(events.map((e) => e.id).sort());
  });

  it('a second phone with the same install (a clone) re-sending the same events is a no-op', async () => {
    await seedMember('alice');
    const first = await phone('alice');
    const events = [basket('alice', first.deviceId, 1)];
    await first.record(...events);
    await first.engine.sync();

    const clone = await phone('alice');
    await clone.record(...events);
    await clone.engine.sync();
    expect(clone.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
    expect(await serverIds()).toHaveLength(1);
  });

  it('the same id with different content is an integrity error, never overwritten', async () => {
    await seedMember('alice');
    const alice = await phone('alice');
    const original = basket('alice', alice.deviceId, 1);
    await alice.record(original);
    await alice.engine.sync();

    const clone = await phone('alice');
    await clone.record({ ...original, netG: 49_000 });
    await clone.engine.sync();
    expect(clone.engine.status()).toMatchObject({ state: 'error', error: 'integrity' });
    expect((await clone.store.pending()).map((e) => e.id)).toEqual([original.id]); // kept, not dropped
    await env.withSecurityRulesDisabled(async (ctx) => {
      const data = (await getDoc(doc(ctx.firestore(), `groups/${GID}/events/${original.id}`))).data()!;
      expect(data.payload.netG).toBe(50_000);
    });
  });
});

describe('permission-denied', () => {
  it('a user who is not in the group sends nothing, gets an error with a retry, and keeps the events', async () => {
    await seedMember('alice');
    const mallory = await phone('mallory'); // scope says GID, but the server has never heard of her
    const e = basket('mallory', mallory.deviceId, 1);
    await mallory.record(e);

    await mallory.engine.sync();
    expect(mallory.engine.status()).toMatchObject({ state: 'error', error: 'denied', pending: 1 });
    expect(await serverIds()).toEqual([]);
    expect((await mallory.store.pending()).map((x) => x.id)).toEqual([e.id]);
  });

  it('a user not yet let into the group sees the error, then recovers once a member', async () => {
    await seedMember('alice');
    const bob = await phone('bob');
    await bob.record(basket('bob', bob.deviceId, 1));
    await bob.engine.sync();
    expect(bob.engine.status()).toMatchObject({ state: 'error', error: 'denied' });

    await seedMember('bob');
    await bob.engine.retry();
    expect(bob.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
    expect(await serverIds()).toHaveLength(1);
  });
});

describe('a group created offline (E02-S02)', () => {
  const somchai = userFromSignIn('somchai', 'สมชาย', { provider: 'google', subject: 'g-1' });

  it('the create_group goes first, then the events — which the rules would refuse the other way round', async () => {
    const gid = 'new-farm';
    const p = await phone('somchai', { groupId: gid });
    const { membership, op } = newGroup(gid, 'สวนบ้านนา', somchai, Date.now());
    await p.accounts.createGroup(membership, op);
    const events = [basket('somchai', p.deviceId, 1, gid), basket('somchai', p.deviceId, 2, gid)];
    await p.record(...events);

    await p.engine.sync();
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
    expect(await p.accounts.pendingOps()).toEqual([]);
    expect(await serverIds(gid)).toEqual(events.map((e) => e.id).sort());
    await env.withSecurityRulesDisabled(async (ctx) => {
      expect((await getDoc(doc(ctx.firestore(), `groups/${gid}`))).data()).toMatchObject({ createdBy: 'somchai', memberCount: 1 });
      expect((await getDoc(doc(ctx.firestore(), `groups/${gid}/members/somchai`))).data()).toMatchObject({ role: 'owner' });
    });
  });

  it('a create_group whose ack was lost is sent again without error', async () => {
    const gid = 'new-farm';
    let lost = false;
    const p = await phone('somchai', {
      groupId: gid,
      wrap: (layer) => ({
        ...layer,
        async commit(writes) {
          await layer.commit(writes);
          if (!lost && writes.some((w) => w.path === `groups/${gid}`)) {
            lost = true;
            throw Object.assign(new Error('ack lost'), { code: 'unavailable' });
          }
        },
      }),
    });
    const { membership, op } = newGroup(gid, 'สวนบ้านนา', somchai, Date.now());
    await p.accounts.createGroup(membership, op);
    await p.record(basket('somchai', p.deviceId, 1, gid));

    await p.engine.sync();
    expect(await p.accounts.pendingOps()).toEqual([op]);
    await p.engine.sync();
    expect(await p.accounts.pendingOps()).toEqual([]);
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
    expect(await serverIds(gid)).toHaveLength(1);
  });

  it("someone else's pending group under a taken id is refused, not merged into", async () => {
    await seedMember('alice'); // alice's group GID exists
    const p = await phone('somchai', { groupId: GID });
    const { membership, op } = newGroup(GID, 'ชนกัน', somchai, Date.now());
    await p.accounts.createGroup(membership, op);
    await p.record(basket('somchai', p.deviceId, 1));

    await p.engine.sync();
    expect(p.engine.status()).toMatchObject({ state: 'error', error: 'denied' });
    expect(await serverIds()).toEqual([]);
  });
});

describe('events the user must not send are never sent', () => {
  const somchai = userFromSignIn('somchai', null, { provider: 'google', subject: 'g-1' });

  it("another group's and another user's events on the same device stay local", async () => {
    await seedMember('alice'); // GID belongs to alice
    const gid = 'somchai-farm';
    const p = await phone('somchai', { groupId: gid });
    const { membership, op } = newGroup(gid, 'ของฉัน', somchai, Date.now());
    await p.accounts.createGroup(membership, op);
    const mine = basket('somchai', p.deviceId, 1, gid);
    const intoAlicesGroup = basket('somchai', p.deviceId, 2, GID);
    const asAlice = basket('alice', p.deviceId, 3, gid);
    await p.record(mine, intoAlicesGroup, asAlice);

    await p.engine.sync();
    expect(await serverIds(gid)).toEqual([mine.id]);
    expect(await serverIds(GID)).toEqual([]);
    expect(p.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
    expect((await p.store.pending()).map((e) => e.id).sort()).toEqual([intoAlicesGroup.id, asAlice.id].sort());
  });
});

describe('offline, then back online (SYNC-1, SYNC-2)', () => {
  it('records while the network is cut, queues nothing in the SDK, and sends by itself when it returns', async () => {
    await seedMember('alice');
    const alice = await phone('alice', { ackTimeoutMs: 3_000 });
    await disableNetwork(alice.db);
    const events = [basket('alice', alice.deviceId, 1), basket('alice', alice.deviceId, 2)];
    await alice.record(...events);

    await alice.engine.sync(); // the server read fails at once: nothing was written, so nothing is queued
    expect(alice.engine.status()).toMatchObject({ state: 'pending', pending: 2 });
    expect(await alice.store.pending()).toHaveLength(2);

    await enableNetwork(alice.db);
    await new Promise((r) => setTimeout(r, 300));
    expect(await serverIds()).toEqual([]); // no stale write landed behind the engine's back

    await alice.engine.sync();
    expect(alice.engine.status()).toMatchObject({ state: 'synced', pending: 0 });
    expect(await alice.store.pending()).toEqual([]);
    expect(await serverIds()).toEqual(events.map((e) => e.id).sort());
  });
});

describe('what real documents look like (review A: coverage)', () => {
  it('a master event with Thai text and an emoji survives the trip exactly', async () => {
    await seedMember('alice');
    await seedMember('bob');
    const alice = await phone('alice');
    const bob = await phone('bob');
    const person: MasterEvent = {
      id: uuidv7(),
      groupId: GID,
      saleId: MASTER_SCOPE,
      seq: 1,
      deviceSeq: 1,
      ts: 1_790_000_000_000,
      mono: 5,
      actor: { userId: 'alice', deviceId: alice.deviceId },
      source: 'app',
      kind: 'master',
      payload: { t: 'person_added', personId: uuidv7(), name: 'สมหญิง ใจดี 🌿 "ตัวอย่าง"', roles: ['tapper'], otherRoles: ['ลูกคนงาน'] },
    };
    await alice.record(person);
    await alice.engine.sync();
    await bob.engine.sync();
    expect(await bob.store.load(MASTER_SCOPE)).toEqual([person]);
  });

  it('a big outbox (60 events: more than the rules\' 20 access calls would allow if each needed a lookup) goes up and comes down in pages', async () => {
    await seedMember('alice');
    await seedMember('bob');
    const alice = await phone('alice');
    const bob = await phone('bob', { pullPageSize: 7 });
    const events = Array.from({ length: 60 }, (_, i) => basket('alice', alice.deviceId, i + 1));
    await alice.record(...events);
    await alice.engine.sync();
    expect(await serverIds()).toHaveLength(60);

    await bob.engine.sync();
    expect(await idsOf(bob)).toEqual(events.map((e) => e.id).sort());
  });
});
