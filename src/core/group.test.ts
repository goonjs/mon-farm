import { describe, expect, it } from 'vitest';

import { createGroupWrites, decideEntry, EmptyGroupNameError, newGroup, type Membership } from './group';

const somchai = { userId: 'uid-1', displayName: 'สมชาย' };
const m = (groupId: string): Membership => ({ groupId, name: `กลุ่ม ${groupId}`, role: 'owner' });

/**
 * E02-S02 (ACC-2…ACC-4, D-24). Where the app opens is decided from the
 * memberships kept on the device, so it is the same answer offline.
 */
describe('decideEntry', () => {
  it('no group: only create or join — nothing to record into (AC3)', () => {
    expect(decideEntry([])).toEqual({ kind: 'start' });
  });

  it('one group: straight in, no picker (AC2)', () => {
    expect(decideEntry([m('g1')])).toEqual({ kind: 'enter', groupId: 'g1' });
  });

  it('two or more: the picker (E02-S04), never a silent choice', () => {
    expect(decideEntry([m('g1'), m('g2')])).toEqual({ kind: 'pick' });
  });
});

describe('newGroup', () => {
  it('makes the creator its owner, under a locally minted id (AC1, ACC-4)', () => {
    const { membership, op } = newGroup('g-local', '  สวนบ้านนา ', somchai, 1_790_000_000_000);
    expect(membership).toEqual({ groupId: 'g-local', name: 'สวนบ้านนา', role: 'owner' });
    expect(op).toEqual({
      op: 'create_group',
      groupId: 'g-local',
      name: 'สวนบ้านนา',
      createdBy: 'uid-1',
      displayName: 'สมชาย',
      createdAt: 1_790_000_000_000,
    });
  });

  it('refuses an empty or blank name', () => {
    expect(() => newGroup('g', '   ', somchai, 0)).toThrow(EmptyGroupNameError);
  });
});

describe('createGroupWrites', () => {
  it('is the group doc and the creator\'s own owner member doc — nobody else', () => {
    const { op } = newGroup('g-local', 'สวนบ้านนา', somchai, 5);
    expect(createGroupWrites(op)).toEqual({
      group: { path: 'groups/g-local', data: { name: 'สวนบ้านนา', createdBy: 'uid-1', createdAt: 5, memberCount: 1 } },
      member: { path: 'groups/g-local/members/uid-1', data: { uid: 'uid-1', role: 'owner', displayName: 'สมชาย', joinedAt: 5 } },
    });
  });
});
