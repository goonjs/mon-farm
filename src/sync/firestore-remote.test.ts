import { describe, expect, it, vi } from 'vitest';

import { canonicalJson } from '../core/canonical';
import { FIXTURE_GROUP_ID, LogBuilder } from '../core/fixtures';
import { newGroup } from '../core/group';
import type { SaleEvent } from '../core/types';
import { userFromSignIn } from '../core/user';
import {
  FirestoreMemberships,
  FirestoreRemote,
  fromEnvelope,
  MalformedDocError,
  remoteErrorCode,
  SERVER_TIMESTAMP,
  toEnvelope,
  toRemoteError,
  whenSignedInAs,
  type DocWrite,
  type FirestoreLayer,
} from './firestore-remote';
import { isTransient, RemoteError } from './remote';

/** Keys the rules accept (firestore.rules `validEvent`). */
const REQUIRED = ['schema', 'id', 'groupId', 'actor', 'deviceSeq', 'kind', 'targetId', 'baseEventId', 'saleId', 'source', 'ts', 'payload', 'receivedAt'];
const ALLOWED = [...REQUIRED, 'alsoBasedOn', 'mono'];

/** Every kind of event the app records today. */
function sampleEvents(): SaleEvent[] {
  const b = new LogBuilder('sale-1', 'dev-A')
    .sys({ t: 'sale_started', farmName: 'สวน', buyer: 'ร้าน', manager: 'ก', workerLead: 'ข', where: 'farm' })
    .accept('p1')
    .acceptAt('pt1', 3)
    .short('p1', 30_000);
  const first = b.build()[1];
  return b.undo('p1', first.id).remove('sale-1').restore('sale-1').build();
}

/** A Firestore stand-in: create-only, stamps `receivedAt`, can fail on demand. */
class FakeLayer implements FirestoreLayer {
  readonly docs = new Map<string, Record<string, unknown>>();
  readonly commits: DocWrite[][] = [];
  failWith: unknown = null;
  now = 1_000;

  private maybeFail() {
    if (this.failWith) {
      const err = this.failWith;
      this.failWith = null;
      throw err;
    }
  }

  async commit(writes: readonly DocWrite[]) {
    this.commits.push([...writes]);
    this.maybeFail();
    if (writes.some((w) => this.docs.has(w.path))) throw Object.assign(new Error('exists'), { code: 'permission-denied' });
    for (const w of writes) {
      const data: Record<string, unknown> = { ...w.data };
      for (const [k, v] of Object.entries(data)) if (v === SERVER_TIMESTAMP) data[k] = (this.now += 1);
      this.docs.set(w.path, data);
    }
  }

  async get(path: string) {
    this.maybeFail();
    return this.docs.get(path) ?? null;
  }

  async groupsOf(userId: string) {
    this.maybeFail();
    return [...this.docs].flatMap(([path, d]) => {
      const m = /^groups\/([^/]+)\/members\/([^/]+)$/.exec(path);
      return m && m[2] === userId ? [{ groupId: m[1], role: d.role }] : [];
    });
  }

  async eventsSince(groupId: string, sinceMs: number, after?: unknown, limit = Infinity) {
    this.maybeFail();
    const all = [...this.docs]
      .filter(([path, d]) => path.startsWith(`groups/${groupId}/events/`) && (d.receivedAt as number) >= sinceMs)
      .map(([path, d]) => ({ path, d }))
      .sort((a, b) => (a.d.receivedAt as number) - (b.d.receivedAt as number) || (a.path < b.path ? -1 : 1));
    const from = after === undefined ? 0 : all.findIndex((x) => x.path === after) + 1;
    const rest = all.slice(from);
    const page = rest.slice(0, limit);
    return { docs: page.map((x) => x.d), next: rest.length > page.length ? page[page.length - 1].path : null };
  }
}

describe('toEnvelope (the shape firestore.rules demands)', () => {
  it.each(sampleEvents().map((e) => [e.kind + (('t' in ((e as { payload?: object }).payload ?? {})) ? '/sys' : ''), e] as const))(
    'a %s event has exactly the required keys and nothing the rules would refuse',
    (_name, event) => {
      const doc = toEnvelope(event);
      for (const key of REQUIRED) expect(Object.keys(doc), key).toContain(key);
      for (const key of Object.keys(doc)) expect(ALLOWED, key).toContain(key);
      expect(doc.schema).toBe(1);
      expect(doc.id).toBe(event.id);
      expect(doc.groupId).toBe(event.groupId);
      expect(doc.actor).toEqual(event.actor);
      expect(doc.receivedAt).toBe(SERVER_TIMESTAMP);
      expect(typeof doc.ts).toBe('number');
      expect(doc.baseEventId).toBeNull();
      expect(typeof doc.targetId).toBe('string');
      expect(typeof doc.payload).toBe('object');
    },
  );

  it("an event with no target of its own targets itself; one that names a target keeps it", () => {
    const [started, basket, , , undo] = sampleEvents();
    expect(toEnvelope(started).targetId).toBe(started.id);
    expect(toEnvelope(basket).targetId).toBe(basket.id);
    expect(toEnvelope(undo).targetId).toBe((undo as { targetId: string }).targetId);
  });

  it("keeps the event's own fields whole in the payload, including a sys event's own payload", () => {
    const [started, basket] = sampleEvents();
    expect(toEnvelope(basket).payload).toMatchObject({ pileId: 'p1', netG: 50_000, tareG: 2_000, input: 'hold' });
    expect((toEnvelope(started).payload as { payload: { t: string } }).payload.t).toBe('sale_started');
    expect(Object.keys(toEnvelope(basket).payload as object)).not.toContain('id');
  });

  it('holds no undefined (Firestore refuses it)', () => {
    const [basket] = new LogBuilder().accept('p1').build();
    const doc = toEnvelope({ ...basket, pointId: undefined } as SaleEvent);
    expect(JSON.stringify(doc.payload)).not.toContain('undefined');
    expect(Object.keys(doc.payload as object)).not.toContain('pointId');
  });
});

describe('fromEnvelope (back from the server)', () => {
  it('returns every event exactly as it was sent', () => {
    for (const event of sampleEvents()) {
      const doc = { ...toEnvelope(event), receivedAt: 5 };
      expect(canonicalJson(fromEnvelope(doc))).toBe(canonicalJson(event));
    }
  });

  it("is the same when Firestore hands the keys back in another order", () => {
    const [event] = sampleEvents();
    const doc = toEnvelope(event);
    const shuffled = Object.fromEntries(Object.entries(doc).reverse());
    expect(canonicalJson(fromEnvelope(shuffled))).toBe(canonicalJson(event));
  });

  it('rejects a document that is not an envelope', () => {
    expect(() => fromEnvelope({ id: 'x' })).toThrow(MalformedDocError);
    expect(() => fromEnvelope({ ...toEnvelope(sampleEvents()[0]), schema: 2 })).toThrow(MalformedDocError);
    expect(() => fromEnvelope({ ...toEnvelope(sampleEvents()[0]), payload: 'text' })).toThrow(MalformedDocError);
  });
});

describe('error mapping (Firestore code → RemoteErrorCode)', () => {
  it.each([
    ['unavailable', 'unavailable', true],
    ['deadline-exceeded', 'deadline-exceeded', true],
    ['unauthenticated', 'unauthenticated', true],
    ['permission-denied', 'permission-denied', false],
    ['invalid-argument', 'invalid-argument', false],
    ['internal', 'internal', true],
    ['already-exists', 'permission-denied', false],
    ['failed-precondition', 'invalid-argument', false],
    ['not-found', 'invalid-argument', false],
    ['out-of-range', 'invalid-argument', false],
    ['unimplemented', 'invalid-argument', false],
    ['resource-exhausted', 'internal', true],
    ['aborted', 'internal', true],
    ['cancelled', 'internal', true],
    ['unknown', 'internal', true],
    ['data-loss', 'internal', true],
    ['something-new', 'internal', true],
  ] as const)('%s becomes %s (transient: %s)', (from, to, transient) => {
    expect(remoteErrorCode(from)).toBe(to);
    expect(isTransient(to)).toBe(transient);
  });

  it('wraps SDK errors, accepts the firestore/ prefix, and treats a bare network failure as offline', () => {
    expect(toRemoteError(Object.assign(new Error('nope'), { code: 'permission-denied' })).code).toBe('permission-denied');
    expect(toRemoteError(Object.assign(new Error('x'), { code: 'firestore/unavailable' })).code).toBe('unavailable');
    expect(toRemoteError(new TypeError('Failed to fetch')).code).toBe('unavailable');
    expect(toRemoteError(new Error('odd')).code).toBe('internal');
    const ours = new RemoteError('unavailable');
    expect(toRemoteError(ours)).toBe(ours);
  });
});

describe('FirestoreRemote', () => {
  const make = () => {
    const layer = new FakeLayer();
    return { layer, remote: new FirestoreRemote(layer, FIXTURE_GROUP_ID, 'user-somchai') };
  };
  const events = () => new LogBuilder('s1', 'dev-A').accept('p1').accept('p1').build();

  it('pushes one batch of create-only documents at groups/{gid}/events/{id}, id as the document id', async () => {
    const { layer, remote } = make();
    const batch = events();
    await remote.push(batch);
    expect(layer.commits).toHaveLength(1);
    expect(layer.commits[0].map((w) => w.path)).toEqual(batch.map((e) => `groups/${FIXTURE_GROUP_ID}/events/${e.id}`));
    expect(layer.commits[0].every((w) => w.data.receivedAt === SERVER_TIMESTAMP)).toBe(true);
  });

  it('refuses at once an event of another group instead of sending it', async () => {
    const { layer, remote } = make();
    const [e] = events();
    await expect(remote.push([{ ...e, groupId: 'other' }])).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(layer.commits).toEqual([]);
  });

  it('maps what the SDK throws, so the engine can tell "try later" from "stop"', async () => {
    const { layer, remote } = make();
    layer.failWith = Object.assign(new Error('offline'), { code: 'unavailable' });
    await expect(remote.push(events())).rejects.toMatchObject({ name: 'RemoteError', code: 'unavailable' });
    layer.failWith = Object.assign(new Error('rules'), { code: 'permission-denied' });
    await expect(remote.push(events())).rejects.toMatchObject({ code: 'permission-denied' });
    layer.failWith = Object.assign(new Error('rules'), { code: 'permission-denied' });
    await expect(remote.pull(0)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('re-sending an id the server holds is refused, as the rules do; fetch then shows it is the same event', async () => {
    const { layer, remote } = make();
    const [e] = events();
    await remote.push([e]);
    await expect(remote.push([e])).rejects.toMatchObject({ code: 'permission-denied' });
    expect(canonicalJson(await remote.fetch(e.id))).toBe(canonicalJson(e));
    expect(layer.docs.size).toBe(1);
  });

  it('fetch answers null for an id the server does not hold', async () => {
    expect(await make().remote.fetch('nope')).toBeNull();
  });

  it('pulls events with the server timestamp as receivedAt, oldest first, from the cursor on', async () => {
    const { remote } = make();
    const [a, b] = events();
    await remote.push([a]);
    await remote.push([b]);
    const all = await remote.pull(0);
    expect(all.docs.map((d) => d.event.id)).toEqual([a.id, b.id]);
    expect(all.docs.map((d) => d.receivedAt)).toEqual([1_001, 1_002]);
    expect((await remote.pull(1_002)).docs.map((d) => d.event.id)).toEqual([b.id]);
  });

  it('pulls in pages: each call continues after the last document of the one before, none twice or missed', async () => {
    const { remote } = make();
    const evs = new LogBuilder('s1', 'dev-A').accept('p1').accept('p1').accept('p1').accept('p1').accept('p1').build();
    for (const e of evs) await remote.push([e]);
    const seen: string[] = [];
    let token: unknown;
    let pages = 0;
    do {
      const page = await remote.pull(0, token, 2);
      seen.push(...page.docs.map((d) => d.event.id));
      token = page.next ?? undefined;
      pages += 1;
    } while (token !== undefined);
    expect(pages).toBe(3);
    expect(seen).toEqual(evs.map((e) => e.id));
  });

  it('check() reads the group document from the server and is happy with any answer, even "not allowed"', async () => {
    const { layer, remote } = make();
    await expect(remote.check()).resolves.toBe(true);
    layer.failWith = Object.assign(new Error('rules'), { code: 'permission-denied' });
    await expect(remote.check()).resolves.toBe(false); // an answer, and it says the group is not readable
  });

  it('check() fails with the real reason when the server cannot be reached or the database is missing', async () => {
    const { layer, remote } = make();
    layer.failWith = Object.assign(new Error('offline'), { code: 'unavailable' });
    await expect(remote.check()).rejects.toMatchObject({ code: 'unavailable' });
    layer.failWith = Object.assign(new Error('The database does not exist'), { code: 'not-found' });
    await expect(remote.check()).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(layer.commits).toEqual([]);
  });

  it('keeps a document the server has not stamped yet as receivedAt null', async () => {
    const { layer, remote } = make();
    const [e] = events();
    layer.docs.set(`groups/${FIXTURE_GROUP_ID}/events/${e.id}`, { ...toEnvelope(e), receivedAt: null });
    expect((await remote.pull(0)).docs.map((d) => d.receivedAt)).toEqual([null]);
  });

  it('skips a malformed document and carries on with the rest', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { layer, remote } = make();
    const [a, b] = events();
    await remote.push([a]);
    layer.docs.set(`groups/${FIXTURE_GROUP_ID}/events/bad`, { id: 'bad', receivedAt: 1_500 });
    await remote.push([b]);
    expect((await remote.pull(0)).docs.map((d) => d.event.id)).toEqual([a.id, b.id]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('FirestoreRemote.createGroup', () => {
  const somchai = userFromSignIn('user-somchai', 'สมชาย', { provider: 'google', subject: 'g-1' });
  const { op } = newGroup(FIXTURE_GROUP_ID, 'สวนบ้านนา', somchai, 1_790_000_000_000);

  it('writes the group and the creator as owner in one batch, the way the rules want', async () => {
    const layer = new FakeLayer();
    await new FirestoreRemote(layer, FIXTURE_GROUP_ID, 'user-somchai').createGroup(op);
    expect(layer.commits).toHaveLength(1);
    expect(layer.commits[0].map((w) => w.path)).toEqual([`groups/${FIXTURE_GROUP_ID}`, `groups/${FIXTURE_GROUP_ID}/members/user-somchai`]);
    expect(layer.docs.get(`groups/${FIXTURE_GROUP_ID}`)).toMatchObject({ createdBy: 'user-somchai', memberCount: 1 });
    expect(layer.docs.get(`groups/${FIXTURE_GROUP_ID}/members/user-somchai`)).toMatchObject({ uid: 'user-somchai', role: 'owner' });
  });

  it('sending it again, after an ack was lost, is success', async () => {
    const layer = new FakeLayer();
    const remote = new FirestoreRemote(layer, FIXTURE_GROUP_ID, 'user-somchai');
    await remote.createGroup(op);
    await expect(remote.createGroup(op)).resolves.toBeUndefined();
    expect(layer.docs.size).toBe(2);
  });

  it("a group someone else created under that id stays refused", async () => {
    const layer = new FakeLayer();
    layer.docs.set(`groups/${FIXTURE_GROUP_ID}`, { createdBy: 'user-mallory', memberCount: 1 });
    await expect(new FirestoreRemote(layer, FIXTURE_GROUP_ID, 'user-somchai').createGroup(op)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('a network failure is transient and writes nothing', async () => {
    const layer = new FakeLayer();
    layer.failWith = Object.assign(new Error('offline'), { code: 'unavailable' });
    await expect(new FirestoreRemote(layer, FIXTURE_GROUP_ID, 'user-somchai').createGroup(op)).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(layer.docs.size).toBe(0);
  });
});

describe('whenSignedInAs', () => {
  const write: DocWrite[] = [{ path: 'groups/g/events/e', data: {} }];

  it('passes calls through when the SDK session is the signed-in user', async () => {
    const layer = new FakeLayer();
    const guarded = whenSignedInAs(layer, async () => 'user-somchai', 'user-somchai');
    await guarded.commit(write);
    expect(await guarded.get('groups/g/events/e')).not.toBeNull();
    await expect(guarded.eventsSince('g', 0)).resolves.toEqual({ docs: [], next: null });
    await expect(guarded.groupsOf('user-somchai')).resolves.toEqual([]);
  });

  it.each([null, 'someone-else'])('with session %j nothing is sent, and it is "unauthenticated" (transient), not "denied"', async (uid) => {
    const layer = new FakeLayer();
    const guarded = whenSignedInAs(layer, async () => uid, 'user-somchai');
    for (const call of [() => guarded.commit(write), () => guarded.get('x'), () => guarded.eventsSince('g', 0), () => guarded.groupsOf('user-somchai')]) {
      const err = await call().catch((e: unknown) => e);
      expect(err).toMatchObject({ name: 'RemoteError', code: 'unauthenticated' });
      expect(isTransient((err as RemoteError).code)).toBe(true);
    }
    expect(layer.commits).toEqual([]);
  });
});

/** E02-S05: "my groups" for a device that has none yet. */
describe('FirestoreMemberships', () => {
  const seed = (layer: FakeLayer, gid: string, name: string, uid: string) => {
    layer.docs.set(`groups/${gid}`, { name, createdBy: uid, createdAt: 1, memberCount: 1 });
    layer.docs.set(`groups/${gid}/members/${uid}`, { uid, role: 'owner', displayName: null, joinedAt: 1 });
  };

  it('lists the groups this user is a member of, with their names, oldest id first', async () => {
    const layer = new FakeLayer();
    seed(layer, 'g-2', 'สวนริมน้ำ', 'user-somchai');
    seed(layer, 'g-1', 'สวนบ้านนา', 'user-somchai');
    seed(layer, 'g-3', 'สวนคนอื่น', 'user-other');
    const groups = await new FirestoreMemberships(layer, 'user-somchai').myGroups();
    expect(groups).toEqual([
      { groupId: 'g-1', name: 'สวนบ้านนา', role: 'owner' },
      { groupId: 'g-2', name: 'สวนริมน้ำ', role: 'owner' },
    ]);
  });

  it('carries the role from the member document, and reads a missing or unknown one as member', async () => {
    const layer = new FakeLayer();
    seed(layer, 'g-1', 'หนึ่ง', 'user-somchai');
    seed(layer, 'g-2', 'สอง', 'user-somchai');
    seed(layer, 'g-3', 'สาม', 'user-somchai');
    layer.docs.set('groups/g-2/members/user-somchai', { uid: 'user-somchai', role: 'member' });
    layer.docs.set('groups/g-3/members/user-somchai', { uid: 'user-somchai', role: 'superuser' });
    const groups = await new FirestoreMemberships(layer, 'user-somchai').myGroups();
    expect(groups.map((g) => g.role)).toEqual(['owner', 'member', 'member']);
  });

  it('a user with no group gets an empty list: a real answer, not an error', async () => {
    const layer = new FakeLayer();
    seed(layer, 'g-3', 'สวนคนอื่น', 'user-other');
    expect(await new FirestoreMemberships(layer, 'user-somchai').myGroups()).toEqual([]);
  });

  it.each([
    ['unavailable', 'unavailable'],
    ['permission-denied', 'permission-denied'],
    ['failed-precondition', 'invalid-argument'], // a missing index
  ])('a %s from the server is a RemoteError (%s), never an empty list', async (sdk, ours) => {
    const layer = new FakeLayer();
    seed(layer, 'g-1', 'สวนบ้านนา', 'user-somchai');
    layer.failWith = Object.assign(new Error('x'), { code: sdk });
    await expect(new FirestoreMemberships(layer, 'user-somchai').myGroups()).rejects.toMatchObject({ name: 'RemoteError', code: ours });
  });

  it('a membership whose group cannot be read is an error, so a farm is never skipped silently', async () => {
    const layer = new FakeLayer();
    layer.docs.set('groups/g-1/members/user-somchai', { uid: 'user-somchai', role: 'owner' });
    await expect(new FirestoreMemberships(layer, 'user-somchai').myGroups()).rejects.toMatchObject({ code: 'internal' });
  });

  it('a group document with no usable name is an error too', async () => {
    const layer = new FakeLayer();
    seed(layer, 'g-1', '', 'user-somchai');
    layer.docs.set('groups/g-1', { createdBy: 'user-somchai' });
    await expect(new FirestoreMemberships(layer, 'user-somchai').myGroups()).rejects.toMatchObject({ code: 'internal' });
  });
});
