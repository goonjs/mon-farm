import { describe, expect, it } from 'vitest';

import {
  applyAll,
  cardStatus,
  editorProblems,
  fullPrice,
  initEditor,
  notUsing,
  partialCards,
  resolvePartial,
  setCardSacks,
  setTake,
  toFields,
  pickCard,
  type EditorState,
} from './fertilizing-editor';
import type { FertilizerCard } from './fertilizing';
import type { Payer } from './types';

const DAENG: Payer = { id: 'p-daeng', name: 'แดง' };
const DAM: Payer = { id: 'p-dam', name: 'ดำ' };
const SOMCHAI: Payer = { id: 'p-somchai', name: 'สมชาย' };
const TAPPERS = [DAENG, DAM, SOMCHAI];

function card(key: string, left: number, o: Partial<FertilizerCard> = {}): FertilizerCard {
  return {
    key,
    type: 'chemical',
    formula: key,
    brand: '',
    sackKg: 50,
    perSackSatang: 30_000,
    items: [{ expenseId: `${key}-1`, orderId: 'o1', date: '2026-10-02', sacks: left, netSatang: left * 30_000, shop: 'ร้าน ก.' }],
    shops: ['ร้าน ก.'],
    deliveredSacks: left,
    usedSacks: 0,
    leftSacks: left,
    ...o,
  };
}

const fresh = (): EditorState => initEditor({ cards: [card('ดีเกลือ', 60), card('46-0-0', 20)], tappers: TAPPERS, record: null });

describe('cards (FZ-2, FZ-3, FZ-9)', () => {
  it('starts with every stock card unused', () => {
    const s = fresh();
    expect(s.cards.map((c) => [c.card.key, c.sacks, c.stock])).toEqual([
      ['ดีเกลือ', 0, 60],
      ['46-0-0', 0, 20],
    ]);
    expect(s.open).toBeNull();
  });

  it('+ uses the whole stock and opens that card; opening another closes the first', () => {
    let s = pickCard(fresh(), 'ดีเกลือ');
    expect(s.cards[0].sacks).toBe(60);
    expect(s.open).toBe('ดีเกลือ');
    s = pickCard(s, '46-0-0');
    expect(s.open).toBe('46-0-0');
  });

  it('"ไม่ใส่อันนี้" and 0 sacks both put the card back unused (D-95)', () => {
    let s = setTake(pickCard(fresh(), 'ดีเกลือ'), 'ดีเกลือ', DAENG.id, 10);
    s = notUsing(s, 'ดีเกลือ');
    expect(s.cards[0].sacks).toBe(0);
    expect(Object.keys(s.cards[0].takes)).toEqual([]);
    const z = setCardSacks(pickCard(fresh(), 'ดีเกลือ'), 'ดีเกลือ', 0);
    expect(z.cards[0].sacks).toBe(0);
  });

  it('"ใช้ทั้งหมด" sets every card back to its full stock (D-94, D-95)', () => {
    let s = setCardSacks(pickCard(fresh(), 'ดีเกลือ'), 'ดีเกลือ', 10);
    s = applyAll(s);
    expect(s.cards.map((c) => c.sacks)).toEqual([60, 20]);
  });

  it('more than in stock is a problem and blocks applying', () => {
    const s = setCardSacks(pickCard(fresh(), 'ดีเกลือ'), 'ดีเกลือ', 61);
    expect(editorProblems(s)).toEqual([{ key: 'ดีเกลือ', problem: 'over-stock', by: 1 }]);
  });

  it('nothing chosen is a problem (the button reads "ยังไม่ได้เลือก")', () => {
    expect(editorProblems(fresh())).toEqual([{ key: null, problem: 'nothing', by: 0 }]);
  });
});

describe('split to tappers (SP-2…SP-6b)', () => {
  it('every tapper starts at 0, untouched', () => {
    const s = pickCard(fresh(), 'ดีเกลือ');
    expect(cardStatus(s.cards[0])).toBe('none');
    expect(s.cards[0].takes).toEqual({});
  });

  it('fills the last untouched tapper with what is left, once someone else was touched (SP-4)', () => {
    let s = pickCard(fresh(), 'ดีเกลือ');
    s = setTake(s, 'ดีเกลือ', DAENG.id, 25);
    expect(s.cards[0].takes[SOMCHAI.id]).toBeUndefined();
    s = setTake(s, 'ดีเกลือ', DAM.id, 20);
    expect(s.cards[0].takes[SOMCHAI.id]).toEqual({ sacks: 15, auto: true });
    expect(cardStatus(s.cards[0])).toBe('full');
  });

  it('the filled value follows a new card amount while its label stays (D-95)', () => {
    let s = setTake(setTake(pickCard(fresh(), 'ดีเกลือ'), 'ดีเกลือ', DAENG.id, 25), 'ดีเกลือ', DAM.id, 20);
    s = setCardSacks(s, 'ดีเกลือ', 50);
    expect(s.cards[0].takes[SOMCHAI.id]).toEqual({ sacks: 5, auto: true });
  });

  it('editing the filled tapper drops the label; 0 there leaves the card part split', () => {
    let s = setTake(setTake(pickCard(fresh(), 'ดีเกลือ'), 'ดีเกลือ', DAENG.id, 25), 'ดีเกลือ', DAM.id, 20);
    s = setTake(s, 'ดีเกลือ', SOMCHAI.id, 0);
    expect(s.cards[0].takes[SOMCHAI.id]).toEqual({ sacks: 0, auto: false });
    expect(cardStatus(s.cards[0])).toBe('partial');
  });

  it('"0 ไม่รับ" counts as touched', () => {
    let s = setTake(pickCard(fresh(), 'ดีเกลือ'), 'ดีเกลือ', DAENG.id, 0);
    s = setTake(s, 'ดีเกลือ', DAM.id, 40);
    expect(s.cards[0].takes[SOMCHAI.id]).toEqual({ sacks: 20, auto: true });
  });

  it('one tapper only is never filled in by itself', () => {
    let s = initEditor({ cards: [card('ดีเกลือ', 10)], tappers: [DAENG], record: null });
    s = pickCard(s, 'ดีเกลือ');
    expect(s.cards[0].takes).toEqual({});
  });

  it('fills per card, separately', () => {
    let s = setTake(setTake(pickCard(fresh(), 'ดีเกลือ'), 'ดีเกลือ', DAENG.id, 25), 'ดีเกลือ', DAM.id, 20);
    s = pickCard(s, '46-0-0');
    expect(s.cards[1].takes).toEqual({});
  });

  it('takes more than the card is "เกิน" and blocks applying (SP-5)', () => {
    const s = setTake(pickCard(fresh(), 'ดีเกลือ'), 'ดีเกลือ', DAENG.id, 61);
    expect(cardStatus(s.cards[0])).toBe('over');
    expect(editorProblems(s)).toEqual([{ key: 'ดีเกลือ', problem: 'takes-over', by: 1 }]);
  });

  it('part split cards are asked one by one; the three answers (SP-6b)', () => {
    let s = setTake(pickCard(fresh(), 'ดีเกลือ'), 'ดีเกลือ', DAENG.id, 50);
    s = setTake(pickCard(s, '46-0-0'), '46-0-0', DAM.id, 5);
    expect(partialCards(s).map((c) => c.card.key)).toEqual(['ดีเกลือ', '46-0-0']);
    const back = resolvePartial(s, 'ดีเกลือ', 'return');
    expect(back.cards[0].sacks).toBe(50);
    expect(cardStatus(back.cards[0])).toBe('full');
    const farm = resolvePartial(s, 'ดีเกลือ', 'farm');
    expect(farm.cards[0].rest).toBe('farm');
    expect(cardStatus(farm.cards[0])).toBe('full');
    const later = resolvePartial(s, 'ดีเกลือ', 'later');
    expect(later.cards[0].rest).toBe('later');
    expect(cardStatus(later.cards[0])).toBe('partial');
    expect(partialCards(later).map((c) => c.card.key)).toEqual(['46-0-0']);
  });

  it('nobody taking anything is "ยังไม่แบ่ง" and is not asked (SP-6)', () => {
    const s = pickCard(fresh(), 'ดีเกลือ');
    expect(partialCards(s)).toEqual([]);
  });
});

describe('toFields / reopen (FZ-9)', () => {
  it('writes one line per used card, its items as sources, touched takes only', () => {
    let s = setTake(setTake(pickCard(fresh(), 'ดีเกลือ'), 'ดีเกลือ', DAENG.id, 25), 'ดีเกลือ', DAM.id, 20);
    s = { ...s, pct: { [DAENG.id]: 40 }, settle: { [DAM.id]: 'paid' } };
    const f = toFields(s, { date: '2026-11-08', zones: [], reasons: [], note: '' });
    expect(f.lines).toEqual([
      {
        sources: ['ดีเกลือ-1'],
        sacks: 60,
        takes: [
          { worker: DAENG, sacks: 25, auto: false },
          { worker: DAM, sacks: 20, auto: false },
          { worker: SOMCHAI, sacks: 15, auto: true },
        ],
        rest: null,
      },
    ]);
    expect(f.pct).toEqual({ [DAENG.id]: 40 });
    expect(f.settle).toEqual({ [DAM.id]: 'paid' });
  });

  it('reopening a saved record brings back its numbers and split', () => {
    const s0 = setTake(pickCard(fresh(), 'ดีเกลือ'), 'ดีเกลือ', DAENG.id, 50);
    const f = toFields(resolvePartial(s0, 'ดีเกลือ', 'later'), { date: '2026-11-08', zones: [], reasons: [], note: '' });
    const s = initEditor({ cards: [card('ดีเกลือ', 60), card('46-0-0', 20)], tappers: TAPPERS, record: { lines: f.lines.map((l) => ({ ...l, cardKeys: ['ดีเกลือ'] })), pct: f.pct, settle: f.settle } });
    expect(s.cards[0].sacks).toBe(60);
    expect(s.cards[0].takes[DAENG.id]).toEqual({ sacks: 50, auto: false });
    expect(s.cards[0].rest).toBe('later');
    // A card with something to split waits open (SP-1).
    expect(s.open).toBe('ดีเกลือ');
  });

  it('preselects the cards of one order (RM-1 "ใส่ปุ๋ยจากใบนี้")', () => {
    const s = initEditor({ cards: [card('ดีเกลือ', 60), card('46-0-0', 20)], tappers: TAPPERS, record: null, preselect: ['46-0-0-1'] });
    expect(s.cards.map((c) => c.sacks)).toEqual([0, 20]);
  });
});

describe('fullPrice — price per sack in full on the summary line (D-96 (2))', () => {
  it('shows baht with satang only when there are any', () => {
    expect(fullPrice(30_000)).toBe('300');
    expect(fullPrice(125_050)).toBe('1,250.50');
    expect(fullPrice(78_005)).toBe('780.05');
  });
});
