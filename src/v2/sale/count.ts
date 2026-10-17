/**
 * What a hold records at a point, shared by the recorder and public mode so
 * both write the same basket (review #1): a full basket, or — when the
 * tapper's short basket is open at another point — its top-up; nothing while
 * it waits at its own point. Counting also needs a passed check at the point
 * (`canCount`, review #11) and a sale still open (review #2).
 */

import { openBasketIn, stdNetOfLog } from '../../core/bridge';
import { canCount } from '../../core/project';
import { recorderFigures } from '../../core/sale-points';
import type { useSaleView } from './pieces';

/** `next`: the open short basket is left as it is, and closes with the first full basket counted (E04-S17). */
export type Fill = 'full' | 'part' | 'next';

export function countModel(view: ReturnType<typeof useSaleView>, pointId: string, fillParam?: string) {
  const { events, state, master, day, mode, append, closed } = view;
  if (!master) return null;
  const pile = state.piles.find((p) => p.id === pointId);
  if (!pile) return null;
  const counted = recorderFigures(events, master, day, pointId, mode, state.price?.satangPerKg ?? null);
  const open = openBasketIn(events, master, day, pointId, mode, stdNetOfLog(events));
  const leftShort = !!open && open.pointId !== pointId && fillParam === 'next' ? open : null;
  const filling = !!open && open.pointId !== pointId && !leftShort;
  const waiting = !!open && open.pointId === pointId;
  const fill: Fill = fillParam === 'part' ? 'part' : 'full';
  const figs = leftShort ? { ...counted, currentNo: leftShort.basketNo + 1 } : counted;
  // A whole-basket top-up weighs the open basket itself, with its own tare (review #9).
  const basketTare = filling && open && fill === 'full' ? open.tareG : pile.tareG;
  const ready = canCount(state, pointId) && !closed;

  /** What was written (the basket's number and net weight), or null when there was nothing to write — callers announce only a real record. */
  const count = (input: 'hold' | 'hold-kbd'): { basketNo: number; netG: number } | null => {
    if (!ready || waiting) return null;
    if (filling && open) {
      append({ kind: 'accept', pileId: pointId, pointId, basketNo: open.basketNo, input, netG: open.missingG, tareG: basketTare, partOf: open.rootId });
      return { basketNo: open.basketNo, netG: open.missingG };
    }
    if (leftShort) append({ kind: 'sys', payload: { t: 'basket_closed', basketId: leftShort.rootId, reason: 'next' } });
    append({ kind: 'accept', pileId: pointId, pointId, basketNo: figs.currentNo, input, netG: pile.stdNetG, tareG: pile.tareG });
    return { basketNo: figs.currentNo, netG: pile.stdNetG };
  };
  const early = (heldMs: number) => {
    if (ready) append({ kind: 'reject', pileId: pointId, input: 'hold', reason: 'released-early', heldMs });
  };
  return { pile, figs, open, filling, waiting, fill, basketTare, ready, count, early };
}
