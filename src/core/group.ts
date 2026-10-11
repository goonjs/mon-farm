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

/**
 * One group a user of this device belongs to, as kept on the device. Kept
 * per `userId`: the store is the device's, and a different account signing
 * in must not open someone else's group (review F5).
 */
export interface Membership {
  readonly groupId: GroupId;
  readonly userId: UserId;
  readonly name: string;
  readonly role: Role;
}

/**
 * Waiting for the outbox: the batch that creates the group on the server.
 * `createdBy` is the user it belongs to — only that user's auth can send it.
 */
export interface CreateGroupOp {
  readonly op: 'create_group';
  readonly groupId: GroupId;
  readonly name: string;
  readonly createdBy: UserId;
  readonly displayName: string | null;
  readonly createdAt: number;
}

export type Entry = { readonly kind: 'start' } | { readonly kind: 'enter'; readonly groupId: GroupId } | { readonly kind: 'pick' };

/** The signed-in user's own memberships, out of everything kept on the device. */
export function membershipsOf(memberships: readonly Membership[], userId: UserId): Membership[] {
  return memberships.filter((m) => m.userId === userId);
}

/**
 * Where the app opens for `userId` (ACC-3): none → create/join, one → in,
 * more → pick (E02-S04). Counts only that user's groups.
 */
export function decideEntry(memberships: readonly Membership[], userId: UserId): Entry {
  const mine = membershipsOf(memberships, userId);
  if (mine.length === 0) return { kind: 'start' };
  if (mine.length === 1) return { kind: 'enter', groupId: mine[0].groupId };
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
    membership: { groupId, userId: creator.userId, name: trimmed, role: 'owner' },
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
