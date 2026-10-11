/**
 * Rubber income (E11-S07, FIN-8): the owner's share of each closed sale on
 * this device, read from the sale logs on focus — never typed in twice.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { saleHistory } from '../core/finance/history';
import { rubberIncome, rubberUnknownDates } from '../core/finance/plan';
import { store } from '../store/store';

export function useRubberIncome() {
  const [rows, setRows] = useState<{ income: ReturnType<typeof rubberIncome>; unknown: string[] }>({ income: [], unknown: [] });
  const reload = useCallback(() => {
    (async () => {
      const ids = await store.listSales();
      const h = saleHistory(await Promise.all(ids.map(async (id) => ({ id, events: await store.load(id) }))));
      setRows({ income: rubberIncome(h.visible), unknown: rubberUnknownDates(h.visible) });
    })().catch((err) => console.error('Sales could not be read.', err));
  }, []);
  useFocusEffect(reload);
  return rows;
}

