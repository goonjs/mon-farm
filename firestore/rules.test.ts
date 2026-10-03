/**
 * Firestore security rules (E01-S08), run against the emulator:
 *
 *   npm run test:rules   (firebase emulators:exec --only firestore …)
 *
 * The matrix is member / non-member / signed out × create / read / update /
 * delete on `groups/{gid}/events/{eventId}`, plus the envelope checks the
 * rules own (id, groupId, actor, receivedAt, schema). Group and membership
 * documents are seeded with rules disabled: creating them is E02's surface.
 */

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

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
