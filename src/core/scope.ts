/**
 * D-24: there is no data outside a farm group. Every event carries the id of
 * the group that was open when it was recorded, from the very first one —
 * which is what server rules (`e.groupId == gid`) and every group-scoped
 * query key on. Checked on the write path and again by the store.
 */

import type { GroupId, UserId } from './types';

export class NoGroupError extends Error {
  constructor() {
    super('Nothing can be recorded outside a farm group.');
    this.name = 'NoGroupError';
  }
}

/** False for an event recorded before groups existed (dev devices): it is never sent. */
export function hasGroup(event: { readonly groupId?: unknown }): boolean {
  return typeof event.groupId === 'string' && event.groupId !== '';
}

export function requireGroupId(groupId: unknown): GroupId {
  if (typeof groupId !== 'string' || groupId === '') throw new NoGroupError();
  return groupId;
}

/** The user and group a sync engine, and the sync badge, are about (E01-S09). */
export interface Scope {
  readonly userId: UserId;
  readonly groupId: GroupId;
}

type Scoped = { readonly groupId?: unknown; readonly actor: { readonly userId: unknown }; readonly kind?: unknown };

/**
 * Whether an event is this user's, in this group. Only those are ever sent: the
 * rules accept only the signed-in user's own events in a group they belong to,
 * so anything else on the device (another account's, another group's, one from
 * before groups existed) could only be refused. It stays put and is not "waiting".
 */
export function belongsTo(scope: Scope, event: Scoped): boolean {
  return hasGroup(event) && event.groupId === scope.groupId && event.actor.userId === scope.userId;
}

/**
 * Events and group-creations this user still has to send for this group: the badge's number.
 *
 * The group's minimum app release (`kind: 'app_min'`, E01-S28) is sent like any event but is not something
 * the farmer recorded, so it is left out of the number (review N8): one expense reads "รอส่ง 1". It still
 * counts as waiting, as 1, when nothing else is, so the badge never says "ซิงก์แล้ว" while it is unsent.
 */
export function waitingCount(
  scope: Scope,
  pendingEvents: readonly Scoped[],
  pendingOps: readonly { readonly groupId: GroupId; readonly createdBy: UserId }[],
): number {
  const mine = pendingEvents.filter((e) => belongsTo(scope, e));
  const recorded = mine.filter((e) => e.kind !== 'app_min').length;
  const ops = pendingOps.filter((o) => o.groupId === scope.groupId && o.createdBy === scope.userId).length;
  const minimumOnly = recorded + ops === 0 && mine.length > 0 ? 1 : 0;
  return recorded + ops + minimumOnly;
}
