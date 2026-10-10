import { describe, expect, it } from 'vitest';

import { workedExample } from '../fixtures';
import { projectSale } from '../project';
import { settle } from '../settle';
import { buyerCheck, buyerCheckPayload, checkBuyerCheck, drillDown, saleFigures, shortByZone, type SaleFigures } from './buyer-check';
import type { FinanceEvent, FinancePayload } from './types';

let n = 0;
function ev(targetId: string, payload: FinancePayload, base: string | null = null, device = 'dev-a'): FinanceEvent {
  n += 1;
  return { id: `b${String(n).padStart(4, '0')}`, deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: device }, source: 'app', targetId, baseEventId: base, payload };
}

const OURS: SaleFigures = { netG: 11273000, satangPerKg: 2650, grossSatang: 29873450, baskets: 226 };
const T = 'buyer-check-s1';

describe('buyer check (E05-S03 · D-72 · SET-6)', () => {
  it('nothing recorded → รอตรวจสอบเทียบยอด (pending)', () => {
    expect(buyerCheck([], 's1', OURS)).toMatchObject({ status: 'pending', recorded: null, stale: false, conflict: false, head: null });
  });

  it('"ตรงกันทั้งหมด" in one tap: buyer figures = ours, status total-verified', () => {
    const p = buyerCheckPayload('s1', 'total', OURS);
    expect(p).toEqual({ t: 'buyer_check_set', saleId: 's1', status: 'total', basis: OURS, buyer: { netG: 11273000, grossSatang: 29873450, baskets: 226 }, reason: '' });
    const a = ev(T, p);
    expect(buyerCheck([a], 's1', OURS)).toMatchObject({ status: 'total', recorded: 'total', stale: false, head: a.id, buyer: p.buyer, diff: { netG: 0, grossSatang: 0, baskets: 0 } });
  });

  it('weight verified keeps holding when only the price changes; total-verified does not', () => {
    const w = ev(T, buyerCheckPayload('s1', 'weight', OURS));
    const repriced = { ...OURS, satangPerKg: 2700, grossSatang: 30437100 };
    expect(buyerCheck([w], 's1', repriced)).toMatchObject({ status: 'weight', stale: false });
    const tot = ev(T, buyerCheckPayload('s1', 'total', OURS), w.id);
    expect(buyerCheck([w, tot], 's1', repriced)).toMatchObject({ status: 'pending', recorded: 'total', stale: true });
  });

  it('a basket edited (or synced in) after the check → back to pending, flagged to recheck, no write needed', () => {
    const a = ev(T, buyerCheckPayload('s1', 'total', OURS));
    const oneMore = { ...OURS, netG: OURS.netG + 50000, grossSatang: OURS.grossSatang + 132500, baskets: 227 };
    expect(buyerCheck([a], 's1', oneMore)).toMatchObject({ status: 'pending', recorded: 'total', stale: true });
    // Weight-verified is stale too when the weight moves.
    const w = ev(T, buyerCheckPayload('s1', 'weight', OURS), a.id);
    expect(buyerCheck([a, w], 's1', oneMore)).toMatchObject({ status: 'pending', recorded: 'weight', stale: true });
  });

  it('difference found carries the buyer figures, the gap (buyer − ours) and the reason; money stays ours (D-15)', () => {
    const p = buyerCheckPayload('s1', 'diff', OURS, { netG: 11223000, grossSatang: null, baskets: 225 }, 'ผู้ซื้อนับเข่งขาดหนึ่ง');
    const a = ev(T, p);
    const r = buyerCheck([a], 's1', OURS);
    expect(r).toMatchObject({ status: 'diff', reason: 'ผู้ซื้อนับเข่งขาดหนึ่ง', diff: { netG: -50000, grossSatang: null, baskets: -1 } });
    expect(r.basis.grossSatang).toBe(29873450);
  });

  it('a difference needs a reason; buyer figures must be whole and not negative', () => {
    expect(checkBuyerCheck('diff', '  ', null)).toEqual(['reason']);
    expect(checkBuyerCheck('diff', 'x', { netG: -1, grossSatang: null, baskets: null })).toEqual(['buyer']);
    expect(checkBuyerCheck('diff', 'x', { netG: 1.5, grossSatang: null, baskets: null })).toEqual(['buyer']);
    expect(checkBuyerCheck('diff', 'x', null)).toEqual([]);
    expect(checkBuyerCheck('total', '', null)).toEqual([]);
  });

  it('undo the check: a pending event clears it', () => {
    const a = ev(T, buyerCheckPayload('s1', 'total', OURS));
    const b = ev(T, buyerCheckPayload('s1', 'pending', OURS), a.id);
    expect(buyerCheck([a, b], 's1', OURS)).toMatchObject({ status: 'pending', recorded: null, head: b.id });
  });

  it('two phones record the same result → merges; different results → conflict, held at pending', () => {
    const a = ev(T, buyerCheckPayload('s1', 'total', OURS), null, 'dev-a');
    const b = ev(T, buyerCheckPayload('s1', 'total', OURS), null, 'dev-b');
    expect(buyerCheck([a, b], 's1', OURS)).toMatchObject({ status: 'total', conflict: false });
    const c = ev(T, buyerCheckPayload('s1', 'diff', OURS, null, 'ไม่ตรง'), null, 'dev-b');
    expect(buyerCheck([a, c], 's1', OURS)).toMatchObject({ status: 'pending', conflict: true });
    // Resolving: a write based on both heads ends the conflict.
    const d = ev(T, { ...buyerCheckPayload('s1', 'diff', OURS, null, 'ไม่ตรง'), alsoBasedOn: [c.id] }, a.id);
    expect(buyerCheck([a, c, d], 's1', OURS)).toMatchObject({ status: 'diff', conflict: false, head: d.id });
  });

  it('other sales are not mixed in', () => {
    const a = ev('buyer-check-s2', buyerCheckPayload('s2', 'total', OURS));
    expect(buyerCheck([a], 's1', OURS).status).toBe('pending');
  });
});

describe('our figures and the drill-down, from the recorded baskets (SET-3, D-15)', () => {
  const events = workedExample();
  const state = projectSale(events);
  const s = settle(events, state);

  it('our figures are the settlement figures', () => {
    expect(saleFigures(s)).toEqual({ netG: 11273000, satangPerKg: 2650, grossSatang: 29873450, baskets: 226 });
  });

  it('short baskets, split by where they came from (owner comment 2026-10-04)', () => {
    expect(shortByZone(s)).toEqual([{ zoneId: 'zA', zoneName: 'โซน A', baskets: 3, netG: 123000 }]);
  });

  it('sale → zone → pile → basket, voided baskets left out', () => {
    const d = drillDown(events, state);
    expect(d.map((z) => [z.zoneId, z.piles.map((p) => [p.pileId, p.baskets.length, p.netG])])).toEqual([
      ['zA', [['p1', 89, 4429000], ['p2', 63, 3144000]]],
      ['zB', [['p3', 74, 3700000]]],
    ]);
    expect(d[0].piles[0].baskets.filter((b) => b.short).map((b) => b.netG)).toEqual([41000, 38000]);
  });
});
