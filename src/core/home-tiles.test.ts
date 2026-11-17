import { homeTiles, salePhase, type TileSale } from './home-tiles';
import type { SalePrep } from './finance/sale-prep';
import type { SaleState } from './types';

/**
 * E15-S06 · the state of the home's เตรียมขาย and เริ่มการขาย tiles (owner 2026-11-17, mockup
 * docs/ux/mockups/e15-s06-home-tiles.html). Every state is derived from the data each time, so going back
 * (a prep un-ticked, a sale reopened) changes the tiles back by itself (HT-4).
 */

const sale = (o: Partial<SaleState> & { piles?: SaleState['piles'] }): SaleState =>
  ({ id: 's', deleted: false, status: 'open', saleStatus: 'draft', piles: [], ...o }) as unknown as SaleState;
const pile = (status: 'not-started' | 'counting' | 'closed') => ({ id: `p-${status}`, status }) as unknown as SaleState['piles'][number];

describe('salePhase — where one sale is', () => {
  it('deleted and cancelled sales are no phase', () => {
    expect(salePhase(sale({ deleted: true }))).toBeNull();
    expect(salePhase(sale({ saleStatus: 'cancelled' }))).toBeNull();
  });

  it('not completed and a pile still being counted, or no pile yet: counting', () => {
    expect(salePhase(sale({ piles: [pile('closed'), pile('counting')] }))).toBe('counting');
    expect(salePhase(sale({ piles: [] }))).toBe('counting');
  });

  it('every pile counted and the sale not completed: at the clearing step', () => {
    expect(salePhase(sale({ piles: [pile('closed'), pile('closed')] }))).toBe('clearing');
  });

  it('reopening a pile takes the sale back to counting (HT-4)', () => {
    expect(salePhase(sale({ piles: [pile('closed'), pile('counting')] }))).toBe('counting');
  });

  it('completed, or the older sale_closed: closed', () => {
    expect(salePhase(sale({ saleStatus: 'completed', piles: [pile('closed')] }))).toBe('closed');
    expect(salePhase(sale({ status: 'closed', piles: [pile('closed')] }))).toBe('closed');
  });
});

const TODAY = '2026-11-18';
const prep = (o: Partial<SalePrep> = {}): SalePrep => ({ buyerId: 'b1', buyerName: 'ก', date: '2026-11-20', time: null, priceSatangPerKg: 5250, updatedTs: 1000, ...o });
const todaySale = (o: Partial<TileSale> = {}): TileSale => ({ id: 's1', ts: 2000, day: TODAY, phase: 'counting', unpaid: 0, ...o });
const base = { prep: null, unsplit: 0, today: TODAY, sales: [] as TileSale[] };

describe('homeTiles — the เตรียมขาย tile (PREP tile: P0 / P1 / P2)', () => {
  it('nothing prepared: plain, no badge (P0)', () => {
    expect(homeTiles(base).prep).toEqual({ state: 'P0' });
  });

  it('started but not complete: yellow with the number of rows left (P1)', () => {
    expect(homeTiles({ ...base, prep: prep({ priceSatangPerKg: null, buyerId: null }) }).prep).toEqual({ state: 'P1', left: 2 });
    expect(homeTiles({ ...base, prep: prep(), unsplit: 3 }).prep).toEqual({ state: 'P1', left: 1 });
  });

  it('all four done: green with a tick (P2)', () => {
    expect(homeTiles({ ...base, prep: prep() }).prep).toEqual({ state: 'P2' });
  });

  it('a prep for a day still to come is kept (HT-5)', () => {
    expect(homeTiles({ ...base, prep: prep({ date: '2026-11-25' }) }).prep).toEqual({ state: 'P2' });
  });

  it('a prep with no day yet is kept', () => {
    expect(homeTiles({ ...base, prep: prep({ date: null }) }).prep).toEqual({ state: 'P1', left: 1 });
  });

  it('a prep for a day that has passed and was never used is cleared (HT-5)', () => {
    expect(homeTiles({ ...base, prep: prep({ date: '2026-11-17' }) }).prep).toEqual({ state: 'P0' });
  });

  it('stays P2 through the sale started today after it was written', () => {
    expect(homeTiles({ ...base, prep: prep(), sales: [todaySale({ ts: 2000, phase: 'closed', unpaid: 2 })] }).prep).toEqual({ state: 'P2' });
  });

  it('used by a sale on an earlier day: cleared (HT-5)', () => {
    const yesterday = todaySale({ id: 'old', ts: 1500, day: '2026-11-17', phase: 'closed' });
    expect(homeTiles({ ...base, prep: prep({ date: null }), sales: [yesterday] }).prep).toEqual({ state: 'P0' });
  });
});

describe('homeTiles — the เริ่มการขาย tile (S0 … S5)', () => {
  it('no prep, no sale: plain (S0); an incomplete prep does not invite either', () => {
    expect(homeTiles(base).start).toEqual({ state: 'S0' });
    expect(homeTiles({ ...base, prep: prep({ priceSatangPerKg: null }) }).start).toEqual({ state: 'S0' });
  });

  it('a complete prep and no sale yet: blue with the clock (S1), even on the day itself', () => {
    expect(homeTiles({ ...base, prep: prep() }).start).toEqual({ state: 'S1' });
    expect(homeTiles({ ...base, prep: prep({ date: TODAY }) }).start).toEqual({ state: 'S1' });
  });

  it('counting: S2, clearing: S3', () => {
    expect(homeTiles({ ...base, prep: prep(), sales: [todaySale({ phase: 'counting' })] }).start).toEqual({ state: 'S2' });
    expect(homeTiles({ ...base, prep: prep(), sales: [todaySale({ phase: 'clearing' })] }).start).toEqual({ state: 'S3' });
  });

  it('closed with piles of money still to pay: green with the number (S4); all paid: S5', () => {
    expect(homeTiles({ ...base, prep: prep(), sales: [todaySale({ phase: 'closed', unpaid: 3 })] }).start).toEqual({ state: 'S4', unpaid: 3 });
    expect(homeTiles({ ...base, prep: prep(), sales: [todaySale({ phase: 'closed', unpaid: 0 })] }).start).toEqual({ state: 'S5' });
  });

  it('selling without a prep: the prep tile stays plain, the sale tile follows the sale (S2)', () => {
    const t = homeTiles({ ...base, sales: [todaySale()] });
    expect(t.prep).toEqual({ state: 'P0' });
    expect(t.start).toEqual({ state: 'S2' });
  });

  it('going back changes the state back: a closed sale reopened is counting again (HT-4)', () => {
    const closed = homeTiles({ ...base, sales: [todaySale({ phase: 'closed', unpaid: 2 })] }).start;
    const reopened = homeTiles({ ...base, sales: [todaySale({ phase: 'counting' })] }).start;
    expect([closed.state, reopened.state]).toEqual(['S4', 'S2']);
  });

  it('with two sales today the newest decides', () => {
    const t = homeTiles({ ...base, sales: [todaySale({ id: 'a', ts: 2000, phase: 'closed', unpaid: 0 }), todaySale({ id: 'b', ts: 3000, phase: 'counting' })] });
    expect(t.start).toEqual({ state: 'S2' });
  });
});

describe('homeTiles — across midnight (Bangkok), unfinished sales leave the tiles (HT-5, HT-6)', () => {
  const yesterdayOpen = todaySale({ id: 'y1', ts: 1500, day: '2026-11-17', phase: 'counting' });
  const yesterdayUnpaid = todaySale({ id: 'y2', ts: 1600, day: '2026-11-17', phase: 'closed', unpaid: 3 });
  const yesterdayDone = todaySale({ id: 'y3', ts: 1700, day: '2026-11-17', phase: 'closed', unpaid: 0 });

  it('both tiles go back to plain and the unfinished sales become rows to deal with', () => {
    const t = homeTiles({ ...base, sales: [yesterdayOpen, yesterdayUnpaid, yesterdayDone] });
    expect(t.prep).toEqual({ state: 'P0' });
    expect(t.start).toEqual({ state: 'S0' });
    expect(t.carried.map((s) => s.id)).toEqual(['y1', 'y2']);
  });

  it('a sale from yesterday that is closed and fully paid is not carried', () => {
    expect(homeTiles({ ...base, sales: [yesterdayDone] }).carried).toEqual([]);
  });

  it('a sale carried for several days stays until it is cleared', () => {
    const old = todaySale({ id: 'old', ts: 10, day: '2026-11-01', phase: 'closed', unpaid: 1 });
    expect(homeTiles({ ...base, sales: [old] }).carried.map((s) => s.id)).toEqual(['old']);
    expect(homeTiles({ ...base, sales: [{ ...old, unpaid: 0 }] }).carried).toEqual([]);
  });

  it('today a new prep and a carried sale live side by side: the tiles show today, the row shows the old sale', () => {
    const t = homeTiles({ ...base, prep: prep({ date: TODAY, updatedTs: 5000 }), sales: [yesterdayUnpaid] });
    expect(t.prep).toEqual({ state: 'P2' });
    expect(t.start).toEqual({ state: 'S1' });
    expect(t.carried.map((s) => s.id)).toEqual(['y2']);
  });

  it('today\'s unfinished sale is not carried', () => {
    expect(homeTiles({ ...base, sales: [todaySale({ phase: 'closed', unpaid: 2 })] }).carried).toEqual([]);
  });
});
