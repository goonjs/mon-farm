/**
 * Moving the weighing to a point, shared by the picker and the counter's
 * "point was deleted" sheet: writes what the move needs (closing another
 * tapper's open basket, adding the point to the sale, recording a skipped
 * check) and opens the empty-scale check or the counter there.
 */

import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

import { pairForNewPoint, planMove } from '../../core/sale-move';
import { pointSetupPayloads } from '../../core/sale-points';
import type { Fill } from './count';
import type { useSaleView } from './pieces';

export type { Fill };

export function useGoToPoint(view: ReturnType<typeof useSaleView>) {
  const router = useRouter();
  const { saleId, events, state, master, day, mode, settings, append } = view;
  return useCallback(
    (pointId: string, opts: { fill?: Fill; replace?: boolean; pairId?: string | null; fromSwitch?: boolean } = {}) => {
      if (!master || !settings) return;
      // From "เปลี่ยนจุด": drop the picker, then replace the old point's counter,
      // so back never opens a live counter at the point just left (review #3).
      const nav = (path: string) => {
        if (opts.fromSwitch && router.canDismiss()) router.dismiss(1);
        (opts.replace || opts.fromSwitch ? router.replace : router.push)(path as Href);
      };
      const plan = planMove(events, state, master, day, pointId, mode, settings.zeroCheck);
      for (const id of plan.closes) append({ kind: 'sys', payload: { t: 'basket_closed', basketId: id, reason: 'tapper-change' } });
      const pair = pairForNewPoint(events, settings, opts.pairId);
      const fillQ = opts.fill ? `&fill=${opts.fill}` : '';
      if (plan.gate) return nav(`/v2/sale/${saleId}/zero-tare?point=${pointId}&net=${pair.netG}&basket=${pair.basketG}${fillQ}`);
      const known = state.piles.some((p) => p.id === pointId);
      for (const payload of pointSetupPayloads(state, master, pointId, pair)) append({ kind: 'sys', payload });
      // Not asked here, by the sale's check mode — recorded, not silent (SALE-6).
      if (!known) append({ kind: 'sys', payload: { t: 'gate_skipped', pileId: pointId, mode: settings.zeroCheck } });
      append({ kind: 'sys', payload: { t: 'ready', pileId: pointId } });
      nav(`/v2/sale/${saleId}/counter?point=${pointId}${fillQ}`);
    },
    [router, saleId, events, state, master, day, mode, settings, append],
  );
}

/** "+2" / "−1" — a skew always shows its sign. */
export function signed(kg: string): string {
  return kg.startsWith('-') ? `−${kg.slice(1)}` : `+${kg}`;
}
