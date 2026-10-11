import { describe, expect, it } from 'vitest';

import { roundingFor, roundSettlement } from './rounding';
import type { FinanceEvent, FinancePayload } from './types';

let n = 0;
function ev(targetId: string, payload: FinancePayload, base: string | null = null, device = 'dev-a'): FinanceEvent {
  n += 1;
  return { id: `r${String(n).padStart(4, '0')}`, groupId: 'group-1', deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: device }, source: 'app', targetId, baseEventId: base, payload };
}

describe('rounding choice (E05-S02)', () => {
  it('per sale; changeable; the last choice on this device is the next sale default', () => {
    const a = ev('sale-rounding-s1', { t: 'sale_rounding_set', saleId: 's1', mode: 'owner' });
    expect(roundingFor([a], 's1', 'dev-a')).toEqual({ mode: 'owner', asked: true, head: a.id });
    expect(roundingFor([a], 's2', 'dev-a')).toEqual({ mode: 'owner', asked: false, head: null });
    const b = ev('sale-rounding-s1', { t: 'sale_rounding_set', saleId: 's1', mode: 'worker' }, a.id);
    expect(roundingFor([a, b], 's1', 'dev-a').mode).toBe('worker');
    expect(roundingFor([], 's1', 'dev-a')).toEqual({ mode: 'none', asked: false, head: null });
  });

  it('review #2: the last choice is remembered for the whole group (D-67), not per device', () => {
    const a = ev('sale-rounding-s1', { t: 'sale_rounding_set', saleId: 's1', mode: 'owner' }, null, 'dev-a');
    expect(roundingFor([a], 's2', 'dev-b')).toEqual({ mode: 'owner', asked: false, head: null });
  });
});

describe('roundSettlement: share → deduct → round → cash; owner + workers + adjust = sale (NFR-3)', () => {
  const workers = [
    { id: 'w1', cashBeforeSatang: 286050 },
    { id: 'w2', cashBeforeSatang: 49025 },
    { id: 'w3', cashBeforeSatang: 100000 },
  ];
  it.each([
    ['worker', [286100, 49100, 100000], [50, 75, 0]],
    ['owner', [286000, 49000, 100000], [-50, -25, 0]],
    ['none', [286050, 49025, 100000], [0, 0, 0]],
  ] as const)('%s', (mode, cash, adjust) => {
    const r = roundSettlement(workers, mode, 1000000);
    expect(r.workers.map((w) => w.cashSatang)).toEqual(cash);
    expect(r.workers.map((w) => w.adjustSatang)).toEqual(adjust);
    const totalAdjust = adjust.reduce((a: number, b: number) => a + b, 0);
    expect(r.ownerSatang).toBe(1000000 - totalAdjust);
    // Every satang accounted for: owner + workers' rounded cash = owner share + workers' pre-round cash.
    expect(r.ownerSatang + cash.reduce((a: number, b: number) => a + b, 0)).toBe(1000000 + 286050 + 49025 + 100000);
  });

  it('no fractions → nothing to ask', () => {
    expect(roundSettlement([{ id: 'w', cashBeforeSatang: 100000 }], 'worker', 5).needsAsking).toBe(false);
    expect(roundSettlement(workers, 'worker', 5).needsAsking).toBe(true);
  });
});
