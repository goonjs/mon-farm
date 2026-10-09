/**
 * Farm groups and the device's own memberships (E02-S02, ACC-2…ACC-4).
 *
 * A group is created on the device, offline if need be, under a locally
 * minted id; the device keeps its membership row and a pending
 * `create_group` operation that the outbox (E01-S09) sends as one batch:
 * the group doc and the creator's own owner member doc
 * (architecture §การดำเนินการด้านสมาชิกภาพ). `role` is always `'owner'` in
 * V1 — the field exists so roles can come later without a reshape.
 */

import type { GroupId, UserId } from './types';

export type Role = 'owner';

/** One group this device's user belongs to, as kept on the device. */
export interface Membership {
  readonly groupId: GroupId;
  readonly name: string;
  readonly role: Role;
}

/** Waiting for the outbox: the batch that creates the group on the server. */
export interface CreateGroupOp {
  readonly op: 'create_group';
  readonly groupId: GroupId;
  readonly name: string;
  readonly createdBy: UserId;
  readonly displayName: string | null;
  readonly createdAt: number;
}

export type Entry = { readonly kind: 'start' } | { readonly kind: 'enter'; readonly groupId: GroupId } | { readonly kind: 'pick' };

/** Where the app opens (ACC-3): none → create/join, one → in, more → pick (E02-S04). */
export function decideEntry(memberships: readonly Membership[]): Entry {
  if (memberships.length === 0) return { kind: 'start' };
  if (memberships.length === 1) return { kind: 'enter', groupId: memberships[0].groupId };
  return { kind: 'pick' };
}

export class EmptyGroupNameError extends Error {
  constructor() {
    super('A farm group needs a name.');
    this.name = 'EmptyGroupNameError';
  }
}

export function newGroup(
  groupId: GroupId,
  name: string,
  creator: { readonly userId: UserId; readonly displayName: string | null },
  now: number,
): { membership: Membership; op: CreateGroupOp } {
  const trimmed = name.trim();
  if (!trimmed) throw new EmptyGroupNameError();
  return {
    membership: { groupId, name: trimmed, role: 'owner' },
    op: {
      op: 'create_group',
      groupId,
      name: trimmed,
      createdBy: creator.userId,
      displayName: creator.displayName,
      createdAt: now,
    },
  };
}

/**
 * The two documents a `create_group` op becomes on the server
 * (architecture §โครง Firestore). Proven against firestore.rules in
 * `firestore/rules.test.ts`.
 */
export function createGroupWrites(op: CreateGroupOp) {
  return {
    group: {
      path: `groups/${op.groupId}`,
      data: { name: op.name, createdBy: op.createdBy, createdAt: op.createdAt, memberCount: 1 },
    },
    member: {
      path: `groups/${op.groupId}/members/${op.createdBy}`,
      data: { uid: op.createdBy, role: 'owner' as Role, displayName: op.displayName, joinedAt: op.createdAt },
    },
  };
}
