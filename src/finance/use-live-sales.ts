/**
 * Which sales still count for the debt ledger: a deduction made at a sale
 * that was later deleted stops reducing the balance, and counts again if the
 * sale is restored (E06-S03). Cancelled joins this once E04-S11 lands.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { projectSale } from '../core/project';
import { store } from '../store/store';

export function useSaleCounts(): (saleId: string) => boolean {
  const [deleted, setDeleted] = useState<ReadonlySet<string>>(new Set());
  const reload = useCallback(() => {
    (async () => {
      const ids = await store.listSales();
      const gone = new Set<string>();
      for (const id of ids) if (projectSale(await store.load(id), id).deleted) gone.add(id);
      setDeleted(gone);
    })().catch((err) => console.error('Sales could not be read.', err));
  }, []);
  useEffect(reload, [reload]);
  useFocusEffect(reload);
  return useCallback((saleId: string) => !deleted.has(saleId), [deleted]);
}
