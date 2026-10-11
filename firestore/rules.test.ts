/**
 * Firestore security rules (E01-S08), run against the emulator:
 *
 *   npm run test:rules   (firebase emulators:exec --only firestore …)
 *
 * The matrix is member / non-member / signed out × create / read / update /
 * delete on `groups/{gid}/events/{eventId}`, plus the envelope checks the
 * rules own (id, groupId, actor, receivedAt, schema, field types), and the
 * group / membership / users / invites rules (create, join, leave, kick,
 * promote, collection-group read). Fixture documents are seeded with rules
 * disabled.
 *
 * Rules cannot cap a document's byte size, so an oversized `payload` from a
 * member is not refused here (Firestore's 1 MiB document limit is the only cap).
 */

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { createGroupWrites, newGroup } from '../src/core/group';

const GID = 'g1';
const OTHER_GID = 'g2';
const MEMBER = 'alice';
const OUTSIDER = 'mallory';

let env: RulesTestEnvironment;

const eventId = (n: number) => `0192f0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

/** A valid envelope as the client would push it (architecture §Event envelope). */
const event = (n: number, overrides: Record<string, unknown> = {}) => ({
  schema: 1,
  id: eventId(n),
  groupId: GID,
  actor: { userId: MEMBER, deviceId: '0192f0a0-0000-7000-8000-00000000d001' },
  deviceSeq: n,
  kind: 'pile.create',
  targetId: `0192f0a0-0000-7000-8000-1${String(n).padStart(11, '0')}`,
  baseEventId: null,
  saleId: null,
  source: 'app',
  ts: 1_790_000_000_000,
  payload: {},
  receivedAt: serverTimestamp(),
  ...overrides,
});

const db = (uid?: string) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

const eventRef = (uid: string | undefined, n: number, gid = GID) =>
  doc(db(uid), `groups/${gid}/events/${eventId(n)}`);

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
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    for (const gid of [GID, OTHER_GID]) {
      await setDoc(doc(admin, `groups/${gid}`), { name: gid, createdBy: 'seed', createdAt: 0, memberCount: 1 });
    }
    await setDoc(doc(admin, `groups/${GID}/members/${MEMBER}`), { uid: MEMBER, role: 'owner' });
    await setDoc(doc(admin, `groups/${OTHER_GID}/members/${OUTSIDER}`), { uid: OUTSIDER, role: 'owner' });
    // An existing event for the read/update/delete cases.
    await setDoc(doc(admin, `groups/${GID}/events/${eventId(1)}`), { ...event(1), receivedAt: 0 });
  });
});

describe('member of the group', () => {
  it('creates an event', async () => {
    await assertSucceeds(setDoc(eventRef(MEMBER, 2), event(2)));
  });

  it('reads events', async () => {
    await assertSucceeds(getDoc(eventRef(MEMBER, 1)));
  });

  // SYNC-4: events are append-only on the server, whoever asks.
  it('can never update an event', async () => {
    await assertFails(updateDoc(eventRef(MEMBER, 1), { payload: { changed: true } }));
  });

  it('can never delete an event', async () => {
    await assertFails(deleteDoc(eventRef(MEMBER, 1)));
  });

  // A re-push of an id that already landed is an update, so it is refused;
  // the client adapter turns "exists with equal canonical JSON" into success.
  it('cannot re-create an event id that already exists', async () => {
    await assertFails(setDoc(eventRef(MEMBER, 1), event(1)));
  });
});

describe('envelope checks', () => {
  it('rejects a document id that differs from the event id', async () => {
    await assertFails(setDoc(eventRef(MEMBER, 2), event(3)));
  });

  it('rejects an event written as someone else', async () => {
    await assertFails(setDoc(eventRef(MEMBER, 2), event(2, { actor: { userId: OUTSIDER, deviceId: 'd' } })));
  });

  it('rejects an event whose groupId is another group', async () => {
    await assertFails(setDoc(eventRef(MEMBER, 2), event(2, { groupId: OTHER_GID })));
  });

  it('rejects a client-chosen receivedAt', async () => {
    await assertFails(setDoc(eventRef(MEMBER, 2), event(2, { receivedAt: 123 })));
  });

  it('rejects an unknown schema version', async () => {
    await assertFails(setDoc(eventRef(MEMBER, 2), event(2, { schema: 2 })));
  });

  it('rejects fields outside the envelope', async () => {
    await assertFails(setDoc(eventRef(MEMBER, 2), event(2, { isAdmin: true })));
  });
});

describe('not a member (ACC-5, NFR-5)', () => {
  it('cannot read another group', async () => {
    await assertFails(getDoc(eventRef(OUTSIDER, 1)));
  });

  it('cannot create in another group, even as itself', async () => {
    await assertFails(
      setDoc(eventRef(OUTSIDER, 2), event(2, { actor: { userId: OUTSIDER, deviceId: 'd' } })),
    );
  });
});

describe('signed out', () => {
  it('cannot read', async () => {
    await assertFails(getDoc(eventRef(undefined, 1)));
  });

  it('cannot create', async () => {
    await assertFails(setDoc(eventRef(undefined, 2), event(2)));
  });
});

// Rules allow at most 20 document access calls per request (a batch counts
// as one request). Each create calls isMember -> exists(memberDoc); this
// proves repeated exists() on the same document is counted once.
describe('a full 500-event batch', () => {
  it('stays under the rules access-call limit', async () => {
    // One Firestore instance: a batch and its refs must come from the same one.
    const firestore = db(MEMBER);
    const batch = writeBatch(firestore);
    for (let n = 100; n < 600; n++) batch.set(doc(firestore, `groups/${GID}/events/${eventId(n)}`), event(n));
    await assertSucceeds(batch.commit());
  });
});

// Architecture §Event envelope: the rules refuse values a client fold would
// have to survive. One case per clause, each mutation-checked.
describe('envelope field types', () => {
  it('accepts a fully populated, well-typed envelope', async () => {
    await assertSucceeds(
      setDoc(
        eventRef(MEMBER, 2),
        event(2, { mono: 12.5, alsoBasedOn: [eventId(1)], baseEventId: eventId(1), saleId: 's-1', source: 'import' }),
      ),
    );
  });

  const bad: [string, Record<string, unknown>][] = [
    ['deviceSeq as a string', { deviceSeq: 'x' }],
    ['deviceSeq of 0', { deviceSeq: 0 }],
    ['deviceSeq as a fraction', { deviceSeq: 1.5 }],
    ['ts as a string', { ts: 'x' }],
    ['mono as a string', { mono: 'x' }],
    ['alsoBasedOn as a string', { alsoBasedOn: 'x' }],
    ['payload as a string', { payload: 'str' }],
    ['payload as a list', { payload: [1] }],
    ['an unknown source', { source: 'evil' }],
    ['kind as a number', { kind: 123 }],
    ['an empty kind', { kind: '' }],
    ['baseEventId as a number', { baseEventId: 5 }],
    ['saleId as a map', { saleId: {} }],
    ['a null targetId', { targetId: null }],
    ['actor without deviceId', { actor: { userId: MEMBER } }],
    ['actor.deviceId as a number', { actor: { userId: MEMBER, deviceId: 5 } }],
  ];
  it.each(bad)('rejects %s', async (_name, overrides) => {
    await assertFails(setDoc(eventRef(MEMBER, 2), event(2, overrides)));
  });
});

// --- groups and membership (ACC-2, ACC-5) -------------------------------------

const CAROL = 'carol';
const BOB = 'bob';
const grp = (uid: string, over: Record<string, unknown> = {}) => ({
  name: 'new',
  createdBy: uid,
  createdAt: 0,
  memberCount: 1,
  ...over,
});

/** Seeds g1 with two members (alice owner, bob) so someone can leave it. */
const seedTwoMembers = async (memberCount = 2) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    await setDoc(doc(admin, `groups/${GID}`), { name: GID, createdBy: 'seed', createdAt: 0, memberCount });
    await setDoc(doc(admin, `groups/${GID}/members/${BOB}`), { uid: BOB, role: 'member' });
  });

describe('creating a group', () => {
  it('succeeds with the owner member document in the same batch', async () => {
    const fs = db(CAROL);
    const batch = writeBatch(fs);
    batch.set(doc(fs, 'groups/g3'), grp(CAROL));
    batch.set(doc(fs, `groups/g3/members/${CAROL}`), { uid: CAROL, role: 'owner' });
    await assertSucceeds(batch.commit());
  });

  it('fails without a member document', async () => {
    await assertFails(setDoc(doc(db(CAROL), 'groups/g3'), grp(CAROL)));
  });

  it('fails when the member document comes without the group', async () => {
    await assertFails(setDoc(doc(db(CAROL), `groups/g3/members/${CAROL}`), { uid: CAROL, role: 'owner' }));
  });

  it('fails when claiming a group id that already exists', async () => {
    const fs = db(CAROL);
    const batch = writeBatch(fs);
    batch.set(doc(fs, `groups/${GID}`), grp(CAROL));
    batch.set(doc(fs, `groups/${GID}/members/${CAROL}`), { uid: CAROL, role: 'owner' });
    await assertFails(batch.commit());
  });
});

// E02-S02: the batch the app queues when a group is created offline
// (`createGroupWrites`), and nothing more — the creator may write the group
// and their own owner membership, never anyone else's (ACC-5).
describe('E02-S02: the app\'s create_group batch', () => {
  const { op } = newGroup('g-local', 'สวนบ้านนา', { userId: CAROL, displayName: 'แครอล' }, 1_790_000_000_000);
  const w = createGroupWrites(op);

  it('is accepted exactly as the app builds it', async () => {
    const fs = db(CAROL);
    const batch = writeBatch(fs);
    batch.set(doc(fs, w.group.path), w.group.data);
    batch.set(doc(fs, w.member.path), w.member.data);
    await assertSucceeds(batch.commit());
  });

  it('cannot also add another person as a member of the new group', async () => {
    const fs = db(CAROL);
    const batch = writeBatch(fs);
    batch.set(doc(fs, w.group.path), w.group.data);
    batch.set(doc(fs, w.member.path), w.member.data);
    batch.set(doc(fs, `groups/g-local/members/${BOB}`), { uid: BOB, role: 'owner' });
    await assertFails(batch.commit());
  });

  it('the creator cannot add another person afterwards either', async () => {
    const fs = db(CAROL);
    const batch = writeBatch(fs);
    batch.set(doc(fs, w.group.path), w.group.data);
    batch.set(doc(fs, w.member.path), w.member.data);
    await assertSucceeds(batch.commit());
    await assertFails(setDoc(doc(db(CAROL), `groups/g-local/members/${BOB}`), { uid: BOB, role: 'owner' }));
  });
});

describe('group creation: first member and re-adding', () => {
  it('fails when the creator\'s own member document is not the owner role', async () => {
    const fs = db(CAROL);
    const batch = writeBatch(fs);
    batch.set(doc(fs, 'groups/g3'), grp(CAROL));
    batch.set(doc(fs, `groups/g3/members/${CAROL}`), { uid: CAROL, role: 'member' });
    await assertFails(batch.commit());
  });

  // The creator leaves, then tries to put themselves back without an invite
  // and without the member count following. Only `!exists(groupDoc)` stops it.
  it('the creator cannot re-add themselves after leaving', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore();
      await setDoc(doc(admin, `groups/${GID}`), { name: GID, createdBy: MEMBER, createdAt: 0, memberCount: 2 });
      await setDoc(doc(admin, `groups/${GID}/members/${BOB}`), { uid: BOB, role: 'member' });
    });
    const fs = db(MEMBER);
    const leave = writeBatch(fs);
    leave.delete(doc(fs, `groups/${GID}/members/${MEMBER}`));
    leave.update(doc(fs, `groups/${GID}`), { memberCount: 1 });
    await assertSucceeds(leave.commit());
    await assertFails(setDoc(doc(db(MEMBER), `groups/${GID}/members/${MEMBER}`), { uid: MEMBER, role: 'owner' }));
  });
});

describe('joining and promotion', () => {
  it('an outsider cannot add themselves to a group', async () => {
    await assertFails(setDoc(doc(db(OUTSIDER), `groups/${GID}/members/${OUTSIDER}`), { uid: OUTSIDER, role: 'member' }));
  });

  it('an outsider cannot join and bump the member count in one batch', async () => {
    const fs = db(OUTSIDER);
    const batch = writeBatch(fs);
    batch.set(doc(fs, `groups/${GID}/members/${OUTSIDER}`), { uid: OUTSIDER, role: 'member' });
    batch.update(doc(fs, `groups/${GID}`), { memberCount: 2 });
    await assertFails(batch.commit());
  });

  it('a member cannot promote themselves to owner', async () => {
    await seedTwoMembers();
    await assertFails(updateDoc(doc(db(BOB), `groups/${GID}/members/${BOB}`), { role: 'owner' }));
  });
});

describe('leaving and removal', () => {
  const leave = (uid: string, countAfter: number | null) => {
    const fs = db(uid);
    const batch = writeBatch(fs);
    batch.delete(doc(fs, `groups/${GID}/members/${uid}`));
    if (countAfter !== null) batch.update(doc(fs, `groups/${GID}`), { memberCount: countAfter });
    return batch.commit();
  };

  it('succeeds when the member document goes and the count drops by one', async () => {
    await seedTwoMembers();
    await assertSucceeds(leave(BOB, 1));
  });

  it('fails when the member document goes without the count update', async () => {
    await seedTwoMembers();
    await assertFails(leave(BOB, null));
  });

  it('fails when the count drops by two', async () => {
    await seedTwoMembers(3);
    await assertFails(leave(BOB, 1));
  });

  it('fails when the count drops but the member stays', async () => {
    await seedTwoMembers();
    await assertFails(updateDoc(doc(db(BOB), `groups/${GID}`), { memberCount: 1 }));
  });

  it('fails for the last member', async () => {
    await assertFails(leave(MEMBER, 0));
  });

  it('cannot remove someone else', async () => {
    await seedTwoMembers();
    const fs = db(MEMBER);
    const batch = writeBatch(fs);
    batch.delete(doc(fs, `groups/${GID}/members/${BOB}`));
    batch.update(doc(fs, `groups/${GID}`), { memberCount: 1 });
    await assertFails(batch.commit());
  });

  it('a group can never be deleted', async () => {
    await assertFails(deleteDoc(doc(db(MEMBER), `groups/${GID}`)));
  });

  it('a former member can still get their own member document', async () => {
    await seedTwoMembers();
    await assertSucceeds(leave(BOB, 1));
    await assertSucceeds(getDoc(doc(db(BOB), `groups/${GID}/members/${BOB}`)));
  });

  it('a former member can no longer read the group or its events', async () => {
    await seedTwoMembers();
    await assertSucceeds(leave(BOB, 1));
    await assertFails(getDoc(doc(db(BOB), `groups/${GID}`)));
    await assertFails(getDoc(eventRef(BOB, 1)));
  });
});

describe('member lookup across groups', () => {
  it('lists your own memberships with a uid filter', async () => {
    await assertSucceeds(getDocs(query(collectionGroup(db(MEMBER), 'members'), where('uid', '==', MEMBER))));
  });

  it('refuses a filter for someone else', async () => {
    await assertFails(getDocs(query(collectionGroup(db(OUTSIDER), 'members'), where('uid', '==', MEMBER))));
  });

  it('refuses an unfiltered listing', async () => {
    await assertFails(getDocs(collectionGroup(db(OUTSIDER), 'members')));
  });

  it("refuses a direct read of another group's member document", async () => {
    await assertFails(getDoc(doc(db(OUTSIDER), `groups/${GID}/members/${MEMBER}`)));
  });
});

describe('users, invites and attempts', () => {
  it('a user reads and writes only their own users document', async () => {
    await assertSucceeds(setDoc(doc(db(MEMBER), `users/${MEMBER}`), { activeGroupId: GID }));
    await assertSucceeds(getDoc(doc(db(MEMBER), `users/${MEMBER}`)));
    await assertFails(getDoc(doc(db(OUTSIDER), `users/${MEMBER}`)));
    await assertFails(setDoc(doc(db(OUTSIDER), `users/${MEMBER}`), { activeGroupId: GID }));
  });

  it('invites and inviteAttempts are closed to clients', async () => {
    await assertFails(getDoc(doc(db(MEMBER), 'invites/123456')));
    await assertFails(setDoc(doc(db(MEMBER), 'invites/123456'), { gid: GID }));
    await assertFails(getDoc(doc(db(MEMBER), `inviteAttempts/${MEMBER}`)));
    await assertFails(setDoc(doc(db(MEMBER), `inviteAttempts/${MEMBER}`), { n: 1 }));
  });
});
