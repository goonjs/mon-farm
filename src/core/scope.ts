/**
 * D-24: there is no data outside a farm group. Every event carries the id of
 * the group that was open when it was recorded, from the very first one —
 * which is what server rules (`e.groupId == gid`) and every group-scoped
 * query key on. Checked on the write path and again by the store.
 */

import type { GroupId } from './types';

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
