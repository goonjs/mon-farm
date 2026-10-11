import { describe, expect, it } from 'vitest';

import { LogBuilder } from './fixtures';
import { basketList } from './sale-points';
import { checkNumbers, filterHistory, historyEquation, historySummary, runningTotals } from './basket-history';
import type { BasketRow } from './sale-points';

const row = (id: string, basketNo: number, over: Partial<BasketRow> = {}): BasketRow => ({
  id,
  basketNo,
  pointId: 'p1',
  netG: 50_000,
  short: false,
  status: 'live',
  edited: false,
  by: { deviceId: 'd', ts: 0 },
  ...over,
});
const tapperOf = (pointId: string) => (pointId === 'p4' ? 'nat' : 'red');

const rows = [
  row('a', 5, { pointId: 'p4' }),
  row('b', 4, { short: true, netG: 20_000 }),
  row('c', 3, { status: 'voided' }),
  row('d', 2, { backfill: true }),
  row('e', 1),
];

describe('historySummary (E04-S15)', () => {
  it('counts live full and short baskets and the kg; a voided row is not in the totals', () => {
    expect(historySummary(rows)).toEqual({ full: 3, short: 1, netG: 170_000 });
  });

  it('an empty list is zero', () => {
    expect(historySummary([])).toEqual({ full: 0, short: 0, netG: 0 });
  });
});

describe('filterHistory (E04-S15)', () => {
  it('all kinds, every tapper → the list as is', () => {
    expect(filterHistory(rows, { kind: 'all', tapperId: null }, tapperOf).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('full keeps full baskets only; short keeps short baskets only', () => {
    expect(filterHistory(rows, { kind: 'full', tapperId: null }, tapperOf).map((r) => r.id)).toEqual(['a', 'c', 'd', 'e']);
    expect(filterHistory(rows, { kind: 'short', tapperId: null }, tapperOf).map((r) => r.id)).toEqual(['b']);
  });

  it('a tapper keeps the baskets of that tapper’s points', () => {
    expect(filterHistory(rows, { kind: 'all', tapperId: 'nat' }, tapperOf).map((r) => r.id)).toEqual(['a']);
    expect(filterHistory(rows, { kind: 'all', tapperId: 'red' }, tapperOf).map((r) => r.id)).toEqual(['b', 'c', 'd', 'e']);
  });

  it('kind and tapper combine', () => {
    expect(filterHistory(rows, { kind: 'short', tapperId: 'nat' }, tapperOf)).toEqual([]);
  });
});

describe('historyEquation (E04-S15: the sum a person can check against the slip)', () => {
  it('full baskets grouped by weight, short baskets one by one, and the total', () => {
    const list = [row('a', 6, { netG: 48_000 }), row('b', 5, { short: true, netG: 20_000 }), row('c', 4), row('d', 3), row('e', 2, { status: 'voided' }), row('f', 1, { status: 'undone' })];
    expect(historyEquation(list)).toEqual({ full: [{ count: 2, eachG: 50_000 }, { count: 1, eachG: 48_000 }], shortsG: [20_000], totalG: 168_000 });
  });

  it('nothing live → empty', () => {
    expect(historyEquation([row('x', 1, { status: 'undone' })])).toEqual({ full: [], shortsG: [], totalG: 0 });
  });
});

describe('runningTotals — the total up to and including each basket, oldest first', () => {
  it('adds live baskets in the order they were recorded; undone and voided rows get none', () => {
    const newestFirst = [row('c', 3), row('b', 2, { status: 'undone' }), row('a', 1, { netG: 30_000 })];
    const t = runningTotals(newestFirst);
    expect(t.get('a')).toBe(30_000);
    expect(t.get('c')).toBe(80_000);
    expect(t.has('b')).toBe(false);
  });
});

describe('checkNumbers — each numbering scope runs 1…n with no gap and no repeat', () => {
  const scopeOf = (pointId: string) => (pointId === 'p4' ? 'nat' : 'red');
  it('a clean sale is ok', () => {
    expect(checkNumbers([row('a', 2), row('b', 1), row('c', 1, { pointId: 'p4' })], scopeOf)).toEqual({ ok: true, problems: [] });
  });

  it('a gap and a repeat are named per scope', () => {
    const r = checkNumbers([row('a', 4), row('b', 2), row('c', 2), row('d', 1), row('e', 2, { pointId: 'p4' })], scopeOf);
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual([
      { scope: 'red', gaps: [3], dups: [2] },
      { scope: 'nat', gaps: [1], dups: [] },
    ]);
  });

  it('undone baskets are not counted; their number is simply used again', () => {
    expect(checkNumbers([row('a', 2), row('u', 2, { status: 'undone' }), row('b', 1)], scopeOf).ok).toBe(true);
  });

  it('a voided number leaves a gap, said as it is', () => {
    expect(checkNumbers([row('a', 3), row('v', 2, { status: 'voided' }), row('b', 1)], scopeOf).problems).toEqual([{ scope: 'red', gaps: [2], dups: [] }]);
  });
});

describe('checkNumbers on real baskets (E04-S15)', () => {
  const b = () => {
    const x = new LogBuilder('sale-x');
    for (const p of ['p1', 'p2']) x.sys({ t: 'pile_added', pileId: p, zoneId: 'fA', name: p, tareG: 2_000, stdNetG: 50_000 });
    return x;
  };
  const scopeOf = () => 'red';

  it('a bridged basket and its top-up part count once; an undone part is not a repeat', () => {
    const x = b().acceptAt('p1', 1).shortAt('p1', 2, 32_000);
    const first = x.build().at(-1)!;
    x.partAt(first.id, 'p2', 2, 20_000);
    const part = x.build().at(-1)!;
    x.undo('p2', part.id);
    x.partAt(first.id, 'p2', 2, 20_000);
    expect(checkNumbers(basketList(x.build(), { withUndone: true }), scopeOf)).toEqual({ ok: true, problems: [] });
  });

  it('the same number recorded twice (two devices merged) is a repeat, and a missing one is a gap', () => {
    const x = b().acceptAt('p1', 1).acceptAt('p1', 1).acceptAt('p1', 3);
    expect(checkNumbers(basketList(x.build()), scopeOf).problems).toEqual([{ scope: 'red', gaps: [2], dups: [1] }]);
  });
});
