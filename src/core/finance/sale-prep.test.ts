import { describe, expect, it } from 'vitest';

import { newFertDebts, prepLeft, SALE_PREP_TARGET, salePrep, type PrepDebtInput } from './sale-prep';
import type { FinanceEvent, FinancePayload } from './types';

/**
 * E15-S01 · the sale prep checklist (owner 2026-11-17 "ก · ก · โอเค ทำตามนี้"). One prep at a time,
 * written as field patches so two phones that set different rows both keep theirs.
 */

let n = 0;
function ev(payload: FinancePayload, opts: { device?: string; ts?: number } = {}): FinanceEvent {
  n += 1;
  return {
    id: `p${String(n).padStart(5, '0')}`,
    groupId: 'group-1',
    deviceSeq: n,
    ts: opts.ts ?? n,
    actor: { userId: 'u', deviceId: opts.device ?? 'dev-a' },
    source: 'app',
    targetId: SALE_PREP_TARGET,
    baseEventId: null,
    payload,
  };
}
const set = (patch: Extract<FinancePayload, { t: 'sale_prep_set' }>['patch'], opts?: { device?: string; ts?: number }) => ev({ t: 'sale_prep_set', patch }, opts);

describe('salePrep — the one prep, field by field (PREP-2..5, PREP-8)', () => {
  it('is null before anything is set', () => {
    expect(salePrep([])).toBeNull();
  });

  it('keeps each field from its latest write, whichever phone wrote it', () => {
    const p = salePrep([
      set({ buyerId: 'b1', buyerName: 'คนรับซื้อยาง ก' }, { device: 'a', ts: 10 }),
      set({ date: '2026-11-21' }, { device: 'b', ts: 11 }),
      set({ priceSatangPerKg: 5250 }, { device: 'a', ts: 12 }),
      set({ time: '08:00' }, { device: 'b', ts: 13 }),
    ]);
    expect(p).toEqual({ buyerId: 'b1', buyerName: 'คนรับซื้อยาง ก', date: '2026-11-21', time: '08:00', priceSatangPerKg: 5250, updatedTs: 13 });
  });

  it('a later write of one field replaces only that field; null clears it', () => {
    const p = salePrep([set({ date: '2026-11-21', time: '08:00' }), set({ priceSatangPerKg: 5250 }), set({ time: null })]);
    expect(p).toMatchObject({ date: '2026-11-21', time: null, priceSatangPerKg: 5250 });
  });

  it('cancelling ends the prep; a write after it starts a new one from nothing', () => {
    const events = [set({ buyerId: 'b1', buyerName: 'ก', date: '2026-11-21' }), set({ cancelled: true })];
    expect(salePrep(events)).toBeNull();
    expect(salePrep([...events, set({ priceSatangPerKg: 4800 })])).toMatchObject({ buyerId: null, date: null, priceSatangPerKg: 4800 });
  });

  it('ignores other events', () => {
    expect(salePrep([ev({ t: 'category_added', name: 'x' })])).toBeNull();
  });
});

describe('prepLeft — how many of the 4 rows are still open (PREP-1, PREP-6)', () => {
  const full = { buyerId: 'b1', buyerName: 'ก', date: '2026-11-21', time: null, priceSatangPerKg: 5250, updatedTs: 1 };
  it('counts buyer, date and price as set, and fertilizer as done when nothing is left to split', () => {
    expect(prepLeft(full, 0)).toBe(0);
    expect(prepLeft(full, 2)).toBe(1);
    expect(prepLeft({ ...full, buyerId: null, priceSatangPerKg: null }, 1)).toBe(3);
  });
  it('the time is optional and never counts', () => {
    expect(prepLeft({ ...full, time: null }, 0)).toBe(0);
  });
});

describe('newFertDebts — new fertilizer debt per tapper since the last sale (PREP-7)', () => {
  const d = (wid: string, name: string, amountSatang: number, date: string, deleted = false): PrepDebtInput => ({ worker: { id: wid, name }, amountSatang, date, deleted });
  it('sums the live lumps per tapper after the last sale day, largest first', () => {
    const out = newFertDebts(
      [d('red', 'แดง', 200_000, '2026-11-15'), d('nat', 'นัด', 160_000, '2026-11-14'), d('red', 'แดง', 120_000, '2026-11-16'), d('red', 'แดง', 999_00, '2026-11-01'), d('nat', 'นัด', 50_000, '2026-11-16', true)],
      '2026-11-10',
    );
    expect(out).toEqual([
      { worker: { id: 'red', name: 'แดง' }, satang: 320_000 },
      { worker: { id: 'nat', name: 'นัด' }, satang: 160_000 },
    ]);
  });
  it('with no sale yet, every live lump counts', () => {
    expect(newFertDebts([d('red', 'แดง', 100, '2020-01-01')], null)).toEqual([{ worker: { id: 'red', name: 'แดง' }, satang: 100 }]);
  });
  it('a lump on the sale day itself was there before the sale', () => {
    expect(newFertDebts([d('red', 'แดง', 100, '2026-11-10')], '2026-11-10')).toEqual([]);
  });
});
