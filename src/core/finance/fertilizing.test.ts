import { describe, expect, it } from 'vitest';

import { projectDebts } from './debts';
import {
  checkFertilizing,
  drawCost,
  FERTILIZING_DEBT_INFIX,
  fertilizerCards,
  fertilizingDebts,
  projectFertilizing,
  STOCK_CUTOFF,
} from './fertilizing';
import { projectFinance } from './ledger';
import {
  FARM_FUNDS,
  type ExpenseFields,
  type FertilizingFields,
  type FertilizingLine,
  type FinanceEvent,
  type FinancePayload,
  type Payer,
} from './types';

let n = 0;
function ev(targetId: string, payload: FinancePayload, opts: { base?: string | null; device?: string } = {}): FinanceEvent {
  n += 1;
  return {
    id: `f${String(n).padStart(4, '0')}`,
    groupId: 'group-1',
    deviceSeq: n,
    ts: n,
    actor: { userId: 'u', deviceId: opts.device ?? 'dev-a' },
    source: 'app',
    targetId,
    baseEventId: opts.base ?? null,
    payload,
  };
}

const FARM: Payer = { id: FARM_FUNDS, name: 'เงินสวน' };
const DAENG: Payer = { id: 'p-daeng', name: 'แดง' };
const DAM: Payer = { id: 'p-dam', name: 'ดำ' };

/** An order item of fertilizer: `sacks` at a net of `netSatang`. */
function item(id: string, o: { sacks: number; netSatang: number; date?: string; stage?: 'actual' | 'committed'; formula?: string; shop?: string }) {
  const fields: ExpenseFields = {
    amountSatang: o.netSatang,
    date: o.date ?? '2026-10-05',
    stage: o.stage ?? 'actual',
    categoryId: 'cat-fertilizer',
    propertyId: null,
    item: o.formula ?? 'ดีเกลือ',
    note: '',
    payer: FARM,
    orderId: `ord-${id}`,
    discountSatang: 0,
    line: { qty: o.sacks, unit: 'กระสอบ', grossSatang: o.netSatang, itemDiscountSatang: 0 },
    fertilizer: {
      type: 'chemical',
      formula: o.formula ?? 'ดีเกลือ',
      brand: '',
      sackKg: 50,
      reasons: [],
      zones: [],
      shop: o.shop ?? 'ร้าน ก.',
      orderedBy: '',
      sacks: o.sacks,
      pricePerSackSatang: Math.round(o.netSatang / o.sacks),
      itemDiscountSatang: 0,
    },
  };
  return ev(id, { t: 'expense_created', fields });
}

function line(sources: string[], sacks: number, takes: FertilizingLine['takes'] = [], rest: FertilizingLine['rest'] = null): FertilizingLine {
  return { sources, sacks, takes, rest };
}

function fz(id: string, over: Partial<FertilizingFields>) {
  const fields: FertilizingFields = { date: '2026-10-20', lines: [], pct: {}, settle: {}, zones: [], reasons: [], note: '', ...over };
  return ev(id, { t: 'fertilizing_recorded', fields });
}

const project = (events: FinanceEvent[], exclude?: string) => projectFertilizing(events, projectFinance(events).expenses, { exclude });

describe('drawCost — exact to the satang', () => {
  it('draws of one item add up to its net however it is cut', () => {
    // 1,000.00 over 3 sacks does not divide; 1 + 1 + 1 still sums to the net.
    const parts = [drawCost(100_000, 3, 0, 1), drawCost(100_000, 3, 1, 2), drawCost(100_000, 3, 2, 3)];
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100_000);
    expect(drawCost(100_000, 3, 0, 3)).toBe(100_000);
  });

  it('prices sacks past the item at the same per-sack rate (over-use)', () => {
    expect(drawCost(30_000, 1, 1, 3)).toBe(60_000);
  });
});

describe('fertilizerCards — stock per type + net price per sack (FZ-2, FL-1, FL-4)', () => {
  it('one card for the same type and price across orders and shops, oldest item first', () => {
    const events = [
      item('b', { sacks: 40, netSatang: 1_200_000, date: '2026-10-09', shop: 'ร้าน ข.' }),
      item('a', { sacks: 60, netSatang: 1_800_000, date: '2026-10-02' }),
    ];
    const cards = fertilizerCards(projectFinance(events).expenses);
    expect(cards).toHaveLength(1);
    expect(cards[0].items.map((i) => i.expenseId)).toEqual(['a', 'b']);
    expect(cards[0].deliveredSacks).toBe(100);
    expect(cards[0].perSackSatang).toBe(30_000);
    expect(cards[0].shops).toEqual(['ร้าน ก.', 'ร้าน ข.']);
  });

  it('a different price per sack is another card (D-92)', () => {
    const events = [item('a', { sacks: 10, netSatang: 300_000 }), item('b', { sacks: 10, netSatang: 310_000 })];
    expect(fertilizerCards(projectFinance(events).expenses)).toHaveLength(2);
  });

  it('only delivered items dated on or after the cutoff count; deleted ones do not', () => {
    expect(STOCK_CUTOFF).toBe('2026-10-01');
    const del = item('d', { sacks: 5, netSatang: 150_000 });
    const events = [
      item('old', { sacks: 10, netSatang: 300_000, date: '2026-09-30' }),
      item('cut', { sacks: 10, netSatang: 300_000, date: '2026-10-01' }),
      item('ord', { sacks: 10, netSatang: 300_000, stage: 'committed' }),
      del,
      ev('d', { t: 'expense_changed', patch: { deleted: true } }, { base: del.id }),
    ];
    const cards = fertilizerCards(projectFinance(events).expenses);
    expect(cards.flatMap((c) => c.items.map((i) => i.expenseId))).toEqual(['cut']);
  });
});

describe('projectFertilizing — draws, stock, flags (FZ-5, FZ-9, FL-1, FL-3)', () => {
  it('draws the oldest item first and the card keeps what is left', () => {
    const events = [
      item('a', { sacks: 60, netSatang: 1_800_000, date: '2026-10-02' }),
      item('b', { sacks: 40, netSatang: 1_200_000, date: '2026-10-09' }),
      fz('fz-1', { lines: [line(['a', 'b'], 70)] }),
    ];
    const p = project(events);
    const r = p.records[0];
    expect(r.lines[0].draws).toEqual([
      { expenseId: 'a', sacks: 60, costSatang: 1_800_000 },
      { expenseId: 'b', sacks: 10, costSatang: 300_000 },
    ]);
    expect(r.lines[0].costSatang).toBe(2_100_000);
    expect(p.cards[0].usedSacks).toBe(70);
    expect(p.cards[0].leftSacks).toBe(30);
  });

  it('orders fertilizings by their date, not by when they were written', () => {
    const events = [
      item('a', { sacks: 10, netSatang: 100_000, date: '2026-10-02' }),
      item('b', { sacks: 10, netSatang: 100_000, date: '2026-10-03' }),
      fz('fz-late', { date: '2026-10-25', lines: [line(['a'], 10)] }),
      fz('fz-early', { date: '2026-10-10', lines: [line(['a'], 10)] }),
    ];
    const p = project(events);
    const by = (id: string) => p.records.find((r) => r.id === id)!;
    expect(by('fz-early').lines[0].draws.map((d) => d.expenseId)).toEqual(['a']);
    expect(by('fz-late').lines[0].draws.map((d) => d.expenseId)).toEqual(['b']);
  });

  it('a later delivery of the same type and price joins the card the line draws from', () => {
    const events = [
      item('a', { sacks: 5, netSatang: 150_000 }),
      item('later', { sacks: 5, netSatang: 150_000, date: '2026-10-15' }),
      fz('fz-1', { lines: [line(['a'], 8)] }),
    ];
    const r = project(events).records[0];
    expect(r.lines[0].draws.map((d) => [d.expenseId, d.sacks])).toEqual([
      ['a', 5],
      ['later', 3],
    ]);
    expect(r.over).toBe(0);
  });

  it('using more than delivered is kept, priced at the same rate and flagged — never cut (FL-3)', () => {
    const events = [
      item('a', { sacks: 10, netSatang: 300_000 }),
      fz('fz-1', { date: '2026-10-10', lines: [line(['a'], 8)] }),
      fz('fz-2', { date: '2026-10-11', lines: [line(['a'], 5)] }),
    ];
    const p = project(events);
    const r2 = p.records.find((r) => r.id === 'fz-2')!;
    expect(r2.lines[0].sacks).toBe(5);
    expect(r2.lines[0].costSatang).toBe(150_000);
    expect(r2.over).toBe(3);
    expect(p.records.find((r) => r.id === 'fz-1')!.over).toBe(0);
    expect(p.cards[0].leftSacks).toBe(-3);
  });

  it('a source moved back to "สั่งไว้" makes its sacks wait: no cost, not over-use', () => {
    const a = item('a', { sacks: 10, netSatang: 300_000 });
    const events = [a, ev('a', { t: 'expense_changed', patch: { stage: 'committed' } }, { base: a.id }), fz('fz-1', { lines: [line(['a'], 4)] })];
    const r = project(events).records[0];
    expect(r.lines[0].waitingSacks).toBe(4);
    expect(r.lines[0].costSatang).toBe(0);
    expect(r.over).toBe(0);
  });

  it('a line whose sources are all gone (deleted or before the cutoff) is orphaned', () => {
    const events = [item('old', { sacks: 10, netSatang: 300_000, date: '2026-09-01' }), fz('fz-1', { lines: [line(['old'], 2)] })];
    const r = project(events).records[0];
    expect(r.lines[0].orphaned).toBe(true);
    expect(r.lines[0].costSatang).toBe(0);
  });

  it('a source whose price was edited onto another card flags the fertilizing as regrouped; money follows the draws', () => {
    const a = item('a', { sacks: 10, netSatang: 300_000 });
    const events = [
      a,
      item('b', { sacks: 10, netSatang: 300_000, date: '2026-10-06' }),
      fz('fz-1', { lines: [line(['a', 'b'], 15)] }),
      ev('a', { t: 'expense_changed', patch: { amountSatang: 250_000 } }, { base: a.id }),
    ];
    const r = project(events).records[0];
    expect(r.regrouped).toBe(true);
    expect(r.lines[0].costSatang).toBe(250_000 + 150_000);
  });

  it('a deleted fertilizing returns its sacks; restoring takes them again (FZ-7)', () => {
    const c = fz('fz-1', { lines: [line(['a'], 4)] });
    const del = ev('fz-1', { t: 'fertilizing_changed', patch: { deleted: true } }, { base: c.id });
    const events = [item('a', { sacks: 10, netSatang: 300_000 }), c, del];
    expect(project(events).cards[0].leftSacks).toBe(10);
    const back = ev('fz-1', { t: 'fertilizing_changed', patch: { deleted: false } }, { base: del.id });
    expect(project([...events, back]).cards[0].leftSacks).toBe(6);
  });

  it('"ในสต็อก" while editing leaves the edited record out (FZ-9)', () => {
    const events = [item('a', { sacks: 10, netSatang: 300_000 }), fz('fz-1', { lines: [line(['a'], 4)] }), fz('fz-2', { date: '2026-10-21', lines: [line(['a'], 3)] })];
    expect(project(events).cards[0].leftSacks).toBe(3);
    expect(project(events, 'fz-1').cards[0].leftSacks).toBe(7);
  });

  it('edits replace the lines whole; two devices changing lines from one base conflict (D-30)', () => {
    const c = fz('fz-1', { lines: [line(['a'], 4)] });
    const events = [
      item('a', { sacks: 10, netSatang: 300_000 }),
      c,
      ev('fz-1', { t: 'fertilizing_changed', patch: { lines: [line(['a'], 5)] } }, { base: c.id, device: 'dev-a' }),
      ev('fz-1', { t: 'fertilizing_changed', patch: { lines: [line(['a'], 6)] } }, { base: c.id, device: 'dev-b' }),
    ];
    const r = project(events).records[0];
    expect(r.conflicts.map((x) => x.field)).toEqual(['lines']);
    // While open, the value from before the fork stands.
    expect(r.lines[0].sacks).toBe(4);
  });
});

describe('fertilizingDebts — one lump per worker per fertilizing (SP-8, SP-10)', () => {
  const twoCards = () => [
    item('a', { sacks: 60, netSatang: 1_800_000, formula: 'ดีเกลือ' }),
    item('k', { sacks: 10, netSatang: 780_000, formula: '46-0-0' }),
  ];

  it('sums the worker cost over every card, then takes their % once', () => {
    const events = [
      ...twoCards(),
      fz('fz-1', {
        lines: [
          line(['a'], 60, [
            { worker: DAENG, sacks: 40, auto: false },
            { worker: DAM, sacks: 20, auto: true },
          ]),
          line(['k'], 10, [{ worker: DAENG, sacks: 5, auto: false }], 'farm'),
        ],
        pct: { [DAENG.id]: 50, [DAM.id]: 40 },
        settle: { [DAENG.id]: 'debt', [DAM.id]: 'debt' },
      }),
    ];
    const debts = fertilizingDebts(project(events));
    const daeng = debts.find((d) => d.worker.id === DAENG.id)!;
    expect(daeng.id).toBe(`fz-1${FERTILIZING_DEBT_INFIX}${DAENG.id}`);
    // 40 × 300 + 5 × 780 = 15,900.00; 50% = 7,950.00
    expect(daeng.amountSatang).toBe(795_000);
    expect(daeng.kind).toBe('fertilizer');
    expect(daeng.date).toBe('2026-10-20');
    expect(daeng.fertilizingId).toBe('fz-1');
    expect(daeng.note).toBe('ดีเกลือ 40 ถุง · 46-0-0 5 ถุง');
    // 20 × 300 = 6,000.00; 40% = 2,400.00
    expect(debts.find((d) => d.worker.id === DAM.id)!.amountSatang).toBe(240_000);
  });

  it('splits a line cost by sacks with cumulative rounding, so the parts add up', () => {
    // 1,000.00 for 3 sacks, one sack each at 100%: 333.33 + 333.34 + 333.33.
    const P: Payer = { id: 'p-x', name: 'x' };
    const events = [
      item('a', { sacks: 3, netSatang: 100_000 }),
      fz('fz-1', {
        lines: [
          line(['a'], 3, [
            { worker: DAENG, sacks: 1, auto: false },
            { worker: DAM, sacks: 1, auto: false },
            { worker: P, sacks: 1, auto: false },
          ]),
        ],
        pct: { [DAENG.id]: 100, [DAM.id]: 100, [P.id]: 100 },
      }),
    ];
    const debts = fertilizingDebts(project(events));
    expect(debts.reduce((s, d) => s + d.amountSatang, 0)).toBe(100_000);
  });

  it('defaults to 50% and "หักตอนขายยาง"; "จ่ายสดแล้ว" makes no debt', () => {
    const events = [
      item('a', { sacks: 10, netSatang: 300_000 }),
      fz('fz-1', {
        lines: [
          line(['a'], 10, [
            { worker: DAENG, sacks: 4, auto: false },
            { worker: DAM, sacks: 6, auto: false },
          ]),
        ],
        settle: { [DAM.id]: 'paid' },
      }),
    ];
    const debts = fertilizingDebts(project(events));
    expect(debts.map((d) => [d.worker.id, d.amountSatang, d.deleted])).toEqual([[DAENG.id, 60_000, false]]);
  });

  it('a worker taking 0 sacks owes nothing', () => {
    const events = [item('a', { sacks: 10, netSatang: 300_000 }), fz('fz-1', { lines: [line(['a'], 10, [{ worker: DAENG, sacks: 0, auto: false }])] })];
    expect(fertilizingDebts(project(events))).toEqual([]);
  });

  it('a lump once owed and no longer (deleted, or switched to paid) stays as a voided row, at what it owed (review of PR 188 S3)', () => {
    const c = fz('fz-1', { lines: [line(['a'], 10, [{ worker: DAENG, sacks: 4, auto: false }])] });
    const events = [item('a', { sacks: 10, netSatang: 300_000 }), c, ev('fz-1', { t: 'fertilizing_changed', patch: { deleted: true } }, { base: c.id })];
    expect(fertilizingDebts(project(events)).map((d) => [d.amountSatang, d.deleted])).toEqual([[60_000, true]]);
  });

  it('follows a price edit at the source (SP-10)', () => {
    const a = item('a', { sacks: 10, netSatang: 300_000 });
    const events = [a, fz('fz-1', { lines: [line(['a'], 10, [{ worker: DAENG, sacks: 10, auto: false }])] })];
    expect(fertilizingDebts(project(events))[0].amountSatang).toBe(150_000);
    const edited = [...events, ev('a', { t: 'expense_changed', patch: { amountSatang: 200_000 } }, { base: a.id })];
    expect(fertilizingDebts(project(edited))[0].amountSatang).toBe(100_000);
  });

  it('a voided lump keeps the amount it last owed, so the history says what was voided (review of PR 188 S3)', () => {
    const c = fz('fz-1', { lines: [line(['a'], 10, [{ worker: DAENG, sacks: 4, auto: false }])], pct: { [DAENG.id]: 50 } });
    const events = [item('a', { sacks: 10, netSatang: 300_000 }), c, ev('fz-1', { t: 'fertilizing_changed', patch: { deleted: true } }, { base: c.id })];
    expect(fertilizingDebts(project(events)).map((d) => [d.amountSatang, d.deleted])).toEqual([[60_000, true]]);
  });

  it('"edited" only when what the debt is made of changed — not for zones, reasons or a delete (review of PR 188 S4)', () => {
    const c = fz('fz-1', { lines: [line(['a'], 10, [{ worker: DAENG, sacks: 4, auto: false }])], pct: { [DAENG.id]: 50 } });
    const base = [item('a', { sacks: 10, netSatang: 300_000 }), c];
    const zones = ev('fz-1', { t: 'fertilizing_changed', patch: { zones: [{ zoneId: 'z', zoneName: 'แปลง' }], reasons: ['text:x'] } }, { base: c.id });
    expect(fertilizingDebts(project([...base, zones]))[0].edited).toBe(false);
    const del = ev('fz-1', { t: 'fertilizing_changed', patch: { deleted: true } }, { base: c.id });
    expect(fertilizingDebts(project([...base, del]))[0].edited).toBe(false);
    const pct = ev('fz-1', { t: 'fertilizing_changed', patch: { pct: { [DAENG.id]: 40 } } }, { base: c.id });
    expect(fertilizingDebts(project([...base, pct]))[0].edited).toBe(true);
  });

  it('says when a source order\'s price changed after the fertilizing, which moved the lump (SP-10, review of PR 188 S4)', () => {
    const a = item('a', { sacks: 10, netSatang: 300_000 });
    const rec = fz('fz-1', { lines: [line(['a'], 10, [{ worker: DAENG, sacks: 10, auto: false }])], pct: { [DAENG.id]: 50 } });
    expect(fertilizingDebts(project([a, rec]))[0].repriced).toBe(false);
    const price = ev('a', { t: 'expense_changed', patch: { amountSatang: 200_000 } }, { base: a.id });
    const d = fertilizingDebts(project([a, rec, price]))[0];
    expect([d.repriced, d.amountSatang]).toEqual([true, 100_000]);
    // A price edited before the fertilizing was recorded is just the price it was bought at.
    expect(fertilizingDebts(project([a, price, rec]))[0].repriced).toBe(false);
  });

  it('marks a lump whose fertilizing was edited after it was written (SP-10)', () => {
    const c = fz('fz-1', { lines: [line(['a'], 10, [{ worker: DAENG, sacks: 4, auto: false }])] });
    const base = [item('a', { sacks: 10, netSatang: 300_000 }), c];
    expect(fertilizingDebts(project(base))[0].edited).toBe(false);
    const edit = ev('fz-1', { t: 'fertilizing_changed', patch: { lines: [line(['a'], 10, [{ worker: DAENG, sacks: 6, auto: false }])] } }, { base: c.id });
    const d = fertilizingDebts(project([...base, edit]))[0];
    expect(d.edited).toBe(true);
    expect(d.amountSatang).toBe(90_000);
  });

  it('a lump whose every take sits on an orphaned line is voided, not a live 0.00 row (review N4)', () => {
    const events = [item('old', { sacks: 10, netSatang: 300_000, date: '2026-09-01' }), fz('fz-1', { lines: [line(['old'], 4, [{ worker: DAENG, sacks: 4, auto: false }])], pct: { [DAENG.id]: 50 } })];
    expect(fertilizingDebts(project(events)).map((d) => [d.amountSatang, d.deleted])).toEqual([[0, true]]);
  });

  it('sacks waiting for a source back at "สั่งไว้" are left out of the debt until it arrives (review N5)', () => {
    const a = item('a', { sacks: 10, netSatang: 300_000 });
    const back = ev('a', { t: 'expense_changed', patch: { stage: 'committed' } }, { base: a.id });
    const rec = fz('fz-1', { lines: [line(['a'], 4, [{ worker: DAENG, sacks: 4, auto: false }])], pct: { [DAENG.id]: 50 } });
    const r = project([a, back, rec]);
    expect(r.records[0].waiting).toBe(4);
    expect(fertilizingDebts(r)[0].amountSatang).toBe(0);
    const again = ev('a', { t: 'expense_changed', patch: { stage: 'actual' } }, { base: back.id });
    expect(fertilizingDebts(project([a, back, rec, again]))[0].amountSatang).toBe(60_000);
  });

  it('voided, then restored, owes again (review N5)', () => {
    const c = fz('fz-1', { lines: [line(['a'], 10, [{ worker: DAENG, sacks: 4, auto: false }])], pct: { [DAENG.id]: 50 } });
    const del = ev('fz-1', { t: 'fertilizing_changed', patch: { deleted: true } }, { base: c.id });
    const back = ev('fz-1', { t: 'fertilizing_changed', patch: { deleted: false } }, { base: del.id });
    const d = fertilizingDebts(project([item('a', { sacks: 10, netSatang: 300_000 }), c, del, back]))[0];
    expect([d.amountSatang, d.deleted]).toEqual([60_000, false]);
  });

  it('two devices offline using the same card past its stock: both kept, the later one flagged (review N5, FL-3)', () => {
    const a = item('a', { sacks: 10, netSatang: 300_000 });
    const one = { ...fz('fz-a', { date: '2026-10-10', lines: [line(['a'], 7)] }), actor: { userId: 'u', deviceId: 'dev-a' } };
    const two = { ...fz('fz-b', { date: '2026-10-11', lines: [line(['a'], 6)] }), actor: { userId: 'u', deviceId: 'dev-b' } };
    const p = project([a, one, two]);
    expect(p.records.map((r) => [r.id, r.over])).toEqual([
      ['fz-b', 3],
      ['fz-a', 0],
    ]);
    expect(p.cards[0].leftSacks).toBe(-3);
  });

  it('pins today\'s delete-vs-edit behaviour: the delete wins silently (known gap, separate story)', () => {
    const c = fz('fz-1', { lines: [line(['a'], 4, [{ worker: DAENG, sacks: 4, auto: false }])], pct: { [DAENG.id]: 50 } });
    const del = ev('fz-1', { t: 'fertilizing_changed', patch: { deleted: true } }, { base: c.id, device: 'dev-a' });
    const edit = ev('fz-1', { t: 'fertilizing_changed', patch: { lines: [line(['a'], 6, [{ worker: DAENG, sacks: 6, auto: false }])] } }, { base: c.id, device: 'dev-b' });
    const r = project([item('a', { sacks: 10, netSatang: 300_000 }), c, del, edit]).records[0];
    expect([r.deleted, r.conflicts]).toEqual([true, []]);
  });

  it('counts in the worker debt account (projectDebts)', () => {
    const events = [item('a', { sacks: 10, netSatang: 300_000 }), fz('fz-1', { lines: [line(['a'], 10, [{ worker: DAENG, sacks: 10, auto: false }])] })];
    const acc = projectDebts(events).get(DAENG.id)!;
    expect(acc.summary.owed.fertilizer).toBe(150_000);
    expect(acc.balanceSatang).toBe(150_000);
  });
});

describe('checkFertilizing', () => {
  const ok: FertilizingFields = {
    date: '2026-10-20',
    lines: [line(['a'], 10, [{ worker: DAENG, sacks: 4, auto: false }])],
    pct: { [DAENG.id]: 50 },
    settle: {},
    zones: [],
    reasons: [],
    note: '',
  };

  it('accepts a valid record', () => {
    expect(checkFertilizing(ok, '2026-11-13')).toEqual([]);
  });

  it('needs a past-or-today date and at least one line (FZ-1)', () => {
    expect(checkFertilizing({ ...ok, date: '2026-11-14' }, '2026-11-13')).toContain('date-future');
    expect(checkFertilizing({ ...ok, date: '' }, '2026-11-13')).toContain('date-required');
    expect(checkFertilizing({ ...ok, lines: [] }, '2026-11-13')).toContain('no-lines');
  });

  it('rejects bad sacks, takes over the line, a source in two lines and a bad %', () => {
    expect(checkFertilizing({ ...ok, lines: [line(['a'], 0)] }, '2026-11-13')).toContain('line-sacks');
    expect(checkFertilizing({ ...ok, lines: [line(['a'], 3, [{ worker: DAENG, sacks: 4, auto: false }])] }, '2026-11-13')).toContain('takes-over');
    expect(checkFertilizing({ ...ok, lines: [line(['a'], 1), line(['a'], 1)] }, '2026-11-13')).toContain('source-twice');
    expect(checkFertilizing({ ...ok, lines: [line([], 1)] }, '2026-11-13')).toContain('line-sources');
    expect(checkFertilizing({ ...ok, pct: { [DAENG.id]: 101 } }, '2026-11-13')).toContain('pct-invalid');
    expect(checkFertilizing({ ...ok, lines: [line(['a'], 10, [{ worker: DAENG, sacks: 2, auto: false }, { worker: DAENG, sacks: 1, auto: false }])] }, '2026-11-13')).toContain('worker-twice');
  });

  it('every tapper who takes sacks has their % stored, so the projection never guesses (review S2)', () => {
    expect(checkFertilizing({ ...ok, pct: {} }, '2026-11-13')).toContain('pct-missing');
    // A tapper touched at 0 takes nothing: no % needed.
    expect(checkFertilizing({ ...ok, lines: [line(['a'], 10, [{ worker: DAENG, sacks: 0, auto: false }])], pct: {} }, '2026-11-13')).toEqual([]);
  });
});
