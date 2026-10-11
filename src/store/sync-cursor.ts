/**
 * How the pull cursor is kept (E01-S09): one slot holding the cursor together
 * with the group it belongs to. Shared by every adapter so they agree.
 */

import type { GroupId } from '../core/types';

export interface StoredCursor {
  readonly groupId: GroupId;
  readonly value: number;
}

/** Ids of pulled documents whose server copy differs from the stored one, kept with their group. */
export interface StoredCorrupt {
  readonly groupId: GroupId;
  readonly ids: readonly string[];
}

/** The corrupt ids stored for `groupId`; anything else (nothing, another group, a wrong shape) is none. */
export function corruptFor(stored: unknown, groupId: GroupId): string[] {
  const s = stored as Partial<StoredCorrupt> | null | undefined;
  return s && typeof s === 'object' && s.groupId === groupId && Array.isArray(s.ids)
    ? s.ids.filter((x): x is string => typeof x === 'string')
    : [];
}

/** The cursor for `groupId` out of whatever is stored; anything else (nothing, another group, an old bare number) is 0. */
export function cursorFor(stored: unknown, groupId: GroupId): number {
  const s = stored as Partial<StoredCursor> | null | undefined;
  return s && typeof s === 'object' && s.groupId === groupId && typeof s.value === 'number' ? s.value : 0;
}
