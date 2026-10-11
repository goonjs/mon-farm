/**
 * Writing to the finance log: stamps the envelope and appends.
 *
 * `deviceSeq` counts this device's FINANCE events (1, 2, 3 …), taken from the
 * log itself rather than the sale log's device clock: until the two logs
 * share one table (see `finance.ts`), a number from the sale counter is not
 * persisted on this side and could repeat after a restart.
 */

import type { FinanceEvent, FinancePayload } from '../core/finance/types';
import type { EventId } from '../core/types';
import { uuidv7 } from '../lib/id';
import { financeStore } from './finance';
import { writerNow } from './record';

export async function writeFinance(
  targetId: string,
  baseEventId: EventId | null,
  payload: FinancePayload,
): Promise<FinanceEvent> {
  const { actor, groupId } = await writerNow();
  const mine = (await financeStore.load()).filter((e) => e.actor.deviceId === actor.deviceId);
  const event: FinanceEvent = {
    id: uuidv7(),
    groupId,
    deviceSeq: mine.reduce((max, e) => Math.max(max, e.deviceSeq), 0) + 1,
    ts: Date.now(),
    actor,
    source: 'app',
    targetId,
    baseEventId,
    payload,
  };
  await financeStore.append(event);
  return event;
}
