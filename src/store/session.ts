import { NoGroupError } from '../core/scope';
import type { GroupId, UserId } from '../core/types';

/**
 * Who is writing (E02-S01, D-23): the signed-in user, set by the account gate
 * once it has read the device's stored session, and read by the write path
 * (`record.ts`) for `actor.userId`. There is no placeholder user any more —
 * before anyone signs in, nothing can be recorded at all (ACC-6).
 */

export class NotSignedInError extends Error {
  constructor() {
    super('Nothing can be recorded before someone signs in.');
    this.name = 'NotSignedInError';
  }
}

let current: UserId | null = null;
let group: GroupId | null = null;

export function setSessionUser(userId: UserId | null): void {
  current = userId;
}

export function sessionUserId(): UserId {
  if (!current) throw new NotSignedInError();
  return current;
}

/**
 * The open farm group (E02-S02, D-24), set by the account gate on entering
 * one. Before that, nothing can be recorded.
 */
export function setSessionGroup(groupId: GroupId | null): void {
  group = groupId;
}

export function sessionGroupId(): GroupId {
  if (!group) throw new NoGroupError();
  return group;
}
