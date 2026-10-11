import { describe, expect, it } from 'vitest';

import { setUpSale, readyPile } from './fixtures';
import { projectSale } from './project';
import { settle } from './settle';
import { basketNetG, liveBaskets, pileTotals, saleTotals } from './totals';
import type { SaleEvent, ShortEvent } from './types';

/** A short basket recorded with an accepted scale skew (E04: skew_accepted). */
function withSkew(events: SaleEvent[], skewG: number): SaleEvent[] {
  return events.map((e) => (e.kind === 'short' ? ({ ...e, skewG } as ShortEvent) : e));
}

describe('totals agree with basketNetG once a skew is accepted (lead bug report 2026-10-10)', () => {
  const b = setUpSale();
  readyPile(b, 'p1');
  b.accept('p1').short('p1', 40_000, 2_000); // 40 − 2 − 2 skew = 36 kg
  const events = withSkew(b.build(), 2_000);

  it('a short basket counts reading − basket − skew in the pile and sale totals', () => {
    expect(pileTotals(events, 'p1')).toMatchObject({ shortBaskets: 1, shortNetG: 36_000, netG: 50_000 + 36_000 });
    expect(saleTotals(events).netG).toBe(liveBaskets(events).reduce((s, x) => s + basketNetG(x), 0));
  });

  it('so settlement and the recorder show the same money', () => {
    const s = settle(events, projectSale(events));
    // 86 kg × 26.50 = 2,279.00
    expect(s.totals.netG).toBe(86_000);
    expect(s.grossSatang).toBe(227_900);
  });
});
