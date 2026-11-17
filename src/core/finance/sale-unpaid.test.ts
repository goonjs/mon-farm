import { describe, expect, it } from 'vitest';

import { workedExample } from '../fixtures';
import { projectSale } from '../project';
import { OWNER_PAYEE, paymentMarkPayload, paymentTarget } from './payments';
import { unpaidPiles } from './sale-unpaid';
import type { FinanceEvent, FinancePayload } from './types';

/**
 * E15-S06 HT-2/HT-6 · "กองเงินที่ต้องจ่าย": how many piles of money of a sale are not ticked paid yet. Counted the
 * way the payment page lists them (each tapper's cash, each cash repayment, the owner's transfer), from the
 * recorded ticks. The worked example settles two tappers and the owner: three piles.
 */

const events = workedExample('sale-1');
const state = projectSale(events, 'sale-1');

let n = 0;
function fin(targetId: string, payload: FinancePayload): FinanceEvent {
  n += 1;
  return { id: `f${String(n).padStart(4, '0')}`, groupId: 'g', deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: 'd' }, source: 'app', targetId, baseEventId: null, payload };
}
const tick = (payee: string, amount: number, done = true) => fin(paymentTarget('sale-1', payee), paymentMarkPayload('sale-1', payee, done, amount));

const count = (finEvents: readonly FinanceEvent[]) => unpaidPiles({ events, state, fin: finEvents, master: null, deviceId: 'd', counts: () => true });

describe('unpaidPiles', () => {
  it('nothing ticked: every pile is still to pay (two tappers and the owner)', () => {
    expect(count([])).toBe(3);
  });

  it('each tick takes one off; all ticked: none left', () => {
    const one = tick('person-prayuth', 10_034_225);
    const two = tick('person-manop', 4_902_500);
    expect(count([one])).toBe(2);
    expect(count([one, two])).toBe(1);
    expect(count([one, two, tick(OWNER_PAYEE, 14_936_725)])).toBe(0);
  });

  it('an un-tick puts the pile back (going back, HT-4)', () => {
    const first = tick('person-prayuth', 10_034_225);
    const undone = { ...tick('person-prayuth', 10_034_225, false), baseEventId: first.id };
    expect(count([first, undone])).toBe(3);
  });

  it('a sale with no recorded price settles nothing, so no pile is waiting', () => {
    const noPrice = events.filter((e) => !(e.kind === 'sys' && e.payload.t === 'price_set'));
    expect(unpaidPiles({ events: noPrice, state: projectSale(noPrice, 'sale-1'), fin: [], master: null, deviceId: 'd', counts: () => true })).toBe(0);
  });
});
