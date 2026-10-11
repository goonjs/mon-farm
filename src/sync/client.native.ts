/**
 * Native sync is not built yet: it needs the Android dev client (E01-S06) to
 * be exercised at all. Until then the app stays local on a phone, with every
 * event kept in the outbox for when it is.
 */

import type { GroupId, UserId } from '../core/types';
import type { SyncRemote } from './client';

export async function connectRemote(_userId: UserId, _groupId: GroupId): Promise<SyncRemote | null> {
  return null;
}
