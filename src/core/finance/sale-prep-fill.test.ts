import { describe, expect, it } from 'vitest';

import { prepFill, type SalePrep } from './sale-prep';

/**
 * E15-S02 · what the start-sale page takes from the prep (owner 2026-11-18 03:01 "ก · ก · ตกลง AC ตาม mockup A–D
 * เริ่มเขียนโค้ดได้ (แนะนำ)"; q1 fill now unless the prep is for a later day, q2 no prepId, q4 no price → buyer only).
 * Pure: the prep as `salePrep` returns it (already null when a sale used it), today's day, the buyers still live.
 */

const TODAY = '2026-11-18';
const BUYERS = ['b1', 'b2'];
const prep = (over: Partial<SalePrep> = {}): SalePrep => ({ buyerId: 'b1', buyerName: 'สหกรณ์บ้านนา', date: TODAY, time: null, priceSatangPerKg: 5250, updatedTs: 1, ...over });

describe('prepFill (PS-2, PS-3, PS-6, PS-7)', () => {
  it('no prep (or one a sale used): nothing to fill — the page is as it was (PS-7)', () => {
    expect(prepFill(null, TODAY, BUYERS)).toBeNull();
  });

  it('a prep for today: buyer and price, filled at once (A)', () => {
    expect(prepFill(prep(), TODAY, BUYERS)).toEqual({ buyerId: 'b1', priceSatangPerKg: 5250, ask: false });
  });

  it('a prep for a day already past, or with no day: filled at once (q1)', () => {
    expect(prepFill(prep({ date: '2026-11-10' }), TODAY, BUYERS)?.ask).toBe(false);
    expect(prepFill(prep({ date: null }), TODAY, BUYERS)?.ask).toBe(false);
  });

  it('a prep for a later day: ask first, with the same values (B)', () => {
    expect(prepFill(prep({ date: '2026-11-21' }), TODAY, BUYERS)).toEqual({ buyerId: 'b1', priceSatangPerKg: 5250, ask: true });
  });

  it('no price in the prep: the buyer only, the price stays empty (C, q4)', () => {
    expect(prepFill(prep({ priceSatangPerKg: null }), TODAY, BUYERS)).toEqual({ buyerId: 'b1', priceSatangPerKg: null, ask: false });
  });

  it('the buyer was deleted since: no buyer, the price still fills', () => {
    expect(prepFill(prep({ buyerId: 'gone' }), TODAY, BUYERS)).toEqual({ buyerId: null, priceSatangPerKg: 5250, ask: false });
  });

  it('a prep with neither a live buyer nor a price has nothing to give: null, and no question for a later day', () => {
    expect(prepFill(prep({ buyerId: null, priceSatangPerKg: null }), TODAY, BUYERS)).toBeNull();
    expect(prepFill(prep({ buyerId: 'gone', priceSatangPerKg: null, date: '2026-11-21' }), TODAY, BUYERS)).toBeNull();
  });

  it('a price of 0 is not a price', () => {
    expect(prepFill(prep({ priceSatangPerKg: 0 }), TODAY, BUYERS)?.priceSatangPerKg).toBeNull();
  });
});
