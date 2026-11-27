/**
 * The finance screens' one way in: the log, its projection, and a writer.
 * Reloads on focus, so a screen returned to shows what another one wrote, and
 * after every pull (E01-S28 round 2, S28-AC3), so a screen left open shows what
 * another phone wrote without leaving it. No live listener: the pull runs on
 * the sync engine's own triggers (S28-AC13).
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { projectFinance, type FinanceState } from '../core/finance/ledger';
import type { FinanceEvent, FinancePayload } from '../core/finance/types';
import type { EventId } from '../core/types';
import { todayIso } from '../core/finance/money';
import { financeStore } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import { deviceClock } from '../store/record';
import { onSyncChanged } from '../sync/changed';
import { useSaleCounts } from './use-live-sales';

export interface UseFinance {
  readonly events: readonly FinanceEvent[] | null;
  readonly state: FinanceState | null;
  readonly deviceId: string | null;
  write(targetId: string, base: EventId | null, payload: FinancePayload): Promise<FinanceEvent>;
  reload(): void;
}

export function useFinance(): UseFinance {
  const [events, setEvents] = useState<FinanceEvent[] | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const reload = useCallback(() => {
    financeStore.load().then(setEvents, (err) => {
      console.error('Finance log could not be read.', err);
      setEvents([]);
    });
  }, []);

  useEffect(() => {
    reload();
    deviceClock.load().then(setDeviceId, () => setDeviceId(null));
  }, [reload]);
  useFocusEffect(reload);
  // "Sync changed" also fires on a send or a status change; a re-read of the local log is cheap and harmless.
  useEffect(() => onSyncChanged(reload), [reload]);

  // A repayment netted at a sale that was later deleted stops counting (D-67).
  const saleCounts = useSaleCounts();
  // Salary months are made up to next month from today's month (E11-S04).
  const asOfMonth = todayIso().slice(0, 7);
  const state = useMemo(() => (events ? projectFinance(events, saleCounts, asOfMonth) : null), [events, saleCounts, asOfMonth]);

  const write = useCallback(
    async (targetId: string, base: EventId | null, payload: FinancePayload) => {
      const event = await writeFinance(targetId, base, payload);
      reload();
      return event;
    },
    [reload],
  );

  return { events, state, deviceId, write, reload };
}
