import { describe, expect, it } from 'vitest';

import { LogBuilder, readyPile, setUpSale } from './fixtures';
import { homeSales } from './home';

/** A sale with `n` standard baskets in กอง 1 (50 kg net each), started `later` seconds on. */
function sale(id: string, n: number, later = 0) {
  const b = new LogBuilder(id);
  for (let i = 0; i < later; i++) b.sys({ t: 'speech_set', on: true });
  setUpSale(b);
  readyPile(b, 'p1');
  for (let i = 0; i < n; i++) b.accept('p1');
  return b;
}

describe('homeSales — the home rows for sales (flow-v1 screen 3)', () => {
  it('is empty with no sales', () => {
    expect(homeSales([])).toEqual({ open: null, latest: null });
  });

  it('an unfinished sale is the open one, with its weight and baskets', () => {
    const events = sale('s1', 3).build();
    const out = homeSales([{ id: 's1', events }]);
    expect(out.latest).toBeNull();
    expect(out.open).toMatchObject({ id: 's1', netG: 150_000, baskets: 3, point: 'p1' });
    expect(out.open?.ts).toBe(events.find((e) => e.kind === 'sys' && e.payload.t === 'sale_started')?.ts);
  });

  it('says weighing only while a pile is being counted', () => {
    const counting = sale('s1', 1).build();
    expect(homeSales([{ id: 's1', events: counting }]).open?.weighing).toBe(true);
    const between = sale('s2', 1).sys({ t: 'pile_closed', pileId: 'p1', forced: false }).build();
    expect(homeSales([{ id: 's2', events: between }]).open?.weighing).toBe(false);
  });

  it('a completed or closed sale is the latest one; the newest start wins', () => {
    const older = sale('s1', 2).sys({ t: 'sale_status_set', status: 'completed' }).build();
    const newer = sale('s2', 1, 5).sys({ t: 'sale_closed' }).build();
    const out = homeSales([{ id: 's1', events: older }, { id: 's2', events: newer }]);
    expect(out.open).toBeNull();
    expect(out.latest).toMatchObject({ id: 's2', netG: 50_000 });
  });

  it('leaves out deleted and cancelled sales', () => {
    const gone = sale('s1', 2).remove('s1').build();
    const cancelled = sale('s2', 2).sys({ t: 'sale_status_set', status: 'cancelled' }).build();
    expect(homeSales([{ id: 's1', events: gone }, { id: 's2', events: cancelled }])).toEqual({ open: null, latest: null });
  });
});
