/**
 * How the pull cursor is kept (E01-S09): one slot holding the cursor together
 * with the group it belongs to. Shared by every adapter so they agree.
 */

import type { GroupId } from '../core/types';

export interface StoredCursor {
  readonly groupId: GroupId;
  readonly value: number;
}

/** The cursor for `groupId` out of whatever is stored; anything else (nothing, another group, an old bare number) is 0. */
export function cursorFor(stored: unknown, groupId: GroupId): number {
  const s = stored as Partial<StoredCursor> | null | undefined;
  return s && typeof s === 'object' && s.groupId === groupId && typeof s.value === 'number' ? s.value : 0;
}
