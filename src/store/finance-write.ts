/**
 * Writing to the finance log: stamps the envelope and appends.
 *
 * Since E01-S28 round 2 the finance log is the one event log, so `deviceSeq`
 * is the app's one device clock — no count of its own; the store has the
 * final word on this device's numbers (append-rule.ts).
 */

import type { FinanceEvent, FinancePayload } from '../core/finance/types';
import type { EventId } from '../core/types';
import { uuidv7 } from '../lib/id';
import { financeStore } from './finance';
import { deviceClock, writerNow } from './record';

export async function writeFinance(
  targetId: string,
  baseEventId: EventId | null,
  payload: FinancePayload,
): Promise<FinanceEvent> {
  const { actor, groupId } = await writerNow();
  const event: FinanceEvent = {
    id: uuidv7(),
    groupId,
    deviceSeq: deviceClock.take(),
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
