/**
 * The finance screens' one way in: the log, its projection, and a writer.
 * Reloads on focus, so a screen returned to shows what another one wrote.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { projectFinance, type FinanceState } from '../core/finance/ledger';
import type { FinanceEvent, FinancePayload } from '../core/finance/types';
import type { EventId } from '../core/types';
import { todayIso } from '../core/finance/money';
import { financeStore } from '../store/finance';
import { writeFinance } from '../store/finance-write';
import { actorNow } from '../store/record';
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
    actorNow().then((a) => setDeviceId(a.deviceId), () => setDeviceId(null));
  }, [reload]);
  useFocusEffect(reload);

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
