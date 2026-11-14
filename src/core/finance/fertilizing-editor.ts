/**
 * E16-S02/S03 · the "ปุ๋ยที่ใส่" page as state (mockup v3, D-94/D-95): one entry per stock card,
 * how many sacks are used from it, and how they are split to tappers. Pure — the screen only
 * renders this and calls these functions; `toFields` is what is saved.
 *
 *   + on a card        → use all of its stock, open it (one card open at a time)
 *   "ไม่ใส่อันนี้" / 0  → back to unused, nothing taken from stock
 *   "ใช้ทั้งหมด"        → every card at its full stock (cards lowered by hand too)
 *   split              → every active tapper starts at 0 and untouched; once someone was touched
 *                        and exactly one is left untouched, that one gets the rest ("เติมให้")
 */

import type { FertilizerCard } from './fertilizing';
import { formatSatang } from './money';
import type { FertilizingFields, FertilizingLine, FertilizingTake, Payer, ShareSettle } from './types';

export interface Take {
  readonly sacks: number;
  readonly auto: boolean;
}

export interface EditorCard {
  readonly card: FertilizerCard;
  /** "N ในสต็อก": the card's stock without this fertilizing's own sacks. */
  readonly stock: number;
  /** 0 = not used. */
  readonly sacks: number;
  /** By worker id; absent = untouched, 0. */
  readonly takes: Readonly<Record<string, Take>>;
  readonly rest: FertilizingLine['rest'];
}

export interface EditorState {
  readonly cards: readonly EditorCard[];
  /** Active tappers, in screen order. */
  readonly tappers: readonly Payer[];
  /** Everyone a take can name (active tappers + people on the saved record). */
  readonly people: Readonly<Record<string, Payer>>;
  readonly open: string | null;
  readonly pct: Readonly<Record<string, number>>;
  readonly settle: Readonly<Record<string, ShareSettle>>;
}

export interface SavedRecord {
  readonly lines: readonly (FertilizingLine & { readonly cardKeys?: readonly string[] })[];
  readonly pct: Readonly<Record<string, number>>;
  readonly settle: Readonly<Record<string, ShareSettle>>;
}

export type CardStatus = 'unused' | 'none' | 'partial' | 'full' | 'over';

const given = (c: EditorCard) => Object.values(c.takes).reduce((s, t) => s + t.sacks, 0);

export function cardStatus(c: EditorCard): CardStatus {
  if (c.sacks === 0) return 'unused';
  const g = given(c);
  if (g > c.sacks) return 'over';
  if (g === 0) return 'none';
  if (g === c.sacks || c.rest === 'farm') return 'full';
  return 'partial';
}

/** SP-4: with someone touched and exactly one active tapper untouched, that one gets what is left. */
function refill(c: EditorCard, tappers: readonly Payer[]): EditorCard {
  const touched = Object.entries(c.takes).filter(([, t]) => !t.auto);
  const takes: Record<string, Take> = Object.fromEntries(touched);
  const untouched = tappers.filter((p) => !takes[p.id]);
  if (c.sacks > 0 && touched.length >= 1 && untouched.length === 1) {
    const rest = c.sacks - touched.reduce((s, [, t]) => s + t.sacks, 0);
    takes[untouched[0].id] = { sacks: Math.max(0, rest), auto: true };
  }
  return { ...c, takes };
}

const mapCard = (s: EditorState, key: string, f: (c: EditorCard) => EditorCard): EditorState => ({
  ...s,
  cards: s.cards.map((c) => (c.card.key === key ? refill(f(c), s.tappers) : c)),
});

export function initEditor(i: {
  /** Stock cards projected WITHOUT the record being edited (`projectFertilizing(..., { exclude })`). */
  readonly cards: readonly FertilizerCard[];
  readonly tappers: readonly Payer[];
  readonly record: SavedRecord | null;
  /** Order-item ids whose cards start used ("ใส่ปุ๋ยจากใบนี้", RM-1). */
  readonly preselect?: readonly string[];
}): EditorState {
  const people: Record<string, Payer> = Object.fromEntries(i.tappers.map((p) => [p.id, p]));
  const lineOf = (c: FertilizerCard) =>
    i.record?.lines.find((l) => (l.cardKeys?.length ? l.cardKeys.includes(c.key) : l.sources.some((s) => c.items.some((x) => x.expenseId === s))));
  const pre = new Set(i.preselect ?? []);
  const cards = i.cards
    .map((c): EditorCard => {
      const line = lineOf(c);
      if (line) {
        for (const t of line.takes) people[t.worker.id] ??= t.worker;
        return { card: c, stock: c.leftSacks, sacks: line.sacks, takes: Object.fromEntries(line.takes.map((t) => [t.worker.id, { sacks: t.sacks, auto: t.auto }])), rest: line.rest };
      }
      const used = c.items.some((x) => pre.has(x.expenseId));
      return { card: c, stock: c.leftSacks, sacks: used ? Math.max(0, c.leftSacks) : 0, takes: {}, rest: null };
    })
    .filter((c) => c.stock > 0 || c.sacks > 0);
  // SP-1: reopened later, the first card with something left to split waits open.
  const waiting = cards.find((c) => c.sacks > 0 && (cardStatus(c) === 'none' || cardStatus(c) === 'partial'));
  return { cards, tappers: i.tappers, people, open: i.record ? (waiting?.card.key ?? null) : null, pct: i.record?.pct ?? {}, settle: i.record?.settle ?? {} };
}

/** + (or tapping the card): an unused card takes all its stock; the card opens and any other closes. */
export function pickCard(s: EditorState, key: string): EditorState {
  const next = mapCard(s, key, (c) => (c.sacks > 0 ? c : { ...c, sacks: Math.max(0, c.stock), rest: null }));
  return { ...next, open: key };
}

/** ⌃/⌄ on a used card. */
export function toggleOpen(s: EditorState, key: string): EditorState {
  return { ...s, open: s.open === key ? null : key };
}

export function notUsing(s: EditorState, key: string): EditorState {
  const next = { ...s, cards: s.cards.map((c) => (c.card.key === key ? { ...c, sacks: 0, takes: {}, rest: null } : c)) };
  return s.open === key ? { ...next, open: null } : next;
}

export function setCardSacks(s: EditorState, key: string, sacks: number): EditorState {
  if (sacks <= 0) return notUsing(s, key);
  return mapCard(s, key, (c) => ({ ...c, sacks, rest: null }));
}

/** "ใช้ทั้งหมด": every card at its full stock. */
export function applyAll(s: EditorState): EditorState {
  return s.cards.reduce((acc, c) => (c.stock > 0 ? mapCard(acc, c.card.key, (x) => ({ ...x, sacks: x.stock, rest: null })) : acc), s);
}

export function setTake(s: EditorState, key: string, workerId: string, sacks: number): EditorState {
  return mapCard(s, key, (c) => ({ ...c, rest: null, takes: { ...c.takes, [workerId]: { sacks, auto: false } } }));
}

export function setPct(s: EditorState, workerId: string, pct: number, settle: ShareSettle): EditorState {
  return { ...s, pct: { ...s.pct, [workerId]: pct }, settle: { ...s.settle, [workerId]: settle } };
}

/** Used cards split only in part and not yet answered — asked one by one on "ใช้ปุ๋ย K อย่าง" (SP-6b). */
export function partialCards(s: EditorState): EditorCard[] {
  return s.cards.filter((c) => cardStatus(c) === 'partial' && c.rest !== 'later');
}

/** SP-6b: "คืน Y ถุงเข้าสต็อก" / "สวนใส่เอง Y ถุง" / "แบ่งที่เหลือทีหลัง". */
export function resolvePartial(s: EditorState, key: string, how: 'return' | 'farm' | 'later'): EditorState {
  if (how === 'return') {
    const c = s.cards.find((x) => x.card.key === key);
    return c ? setCardSacksKeepRest(s, key, given(c)) : s;
  }
  return { ...s, cards: s.cards.map((c) => (c.card.key === key ? { ...c, rest: how } : c)) };
}

const setCardSacksKeepRest = (s: EditorState, key: string, sacks: number) => (sacks <= 0 ? notUsing(s, key) : { ...s, cards: s.cards.map((c) => (c.card.key === key ? { ...c, sacks, rest: null } : c)) });

export type EditorProblem = { readonly key: string | null; readonly problem: 'nothing' | 'over-stock' | 'takes-over'; readonly by: number };

/** What keeps "ใช้ปุ๋ย K อย่าง" off. */
export function editorProblems(s: EditorState): EditorProblem[] {
  const used = s.cards.filter((c) => c.sacks > 0);
  if (!used.length) return [{ key: null, problem: 'nothing', by: 0 }];
  const out: EditorProblem[] = [];
  for (const c of used) {
    if (c.sacks > c.stock) out.push({ key: c.card.key, problem: 'over-stock', by: c.sacks - c.stock });
    else if (given(c) > c.sacks) out.push({ key: c.card.key, problem: 'takes-over', by: given(c) - c.sacks });
  }
  return out;
}

/** The record's lines and split, replacing the whole set (FZ-9). */
export function toFields(s: EditorState, rest: Pick<FertilizingFields, 'date' | 'zones' | 'reasons' | 'note'>): FertilizingFields {
  const order = [...s.tappers.map((p) => p.id), ...Object.keys(s.people).filter((id) => !s.tappers.some((p) => p.id === id))];
  const lines = s.cards
    .filter((c) => c.sacks > 0)
    .map((c): FertilizingLine => {
      const takes: FertilizingTake[] = order.filter((id) => c.takes[id]).map((id) => ({ worker: s.people[id], sacks: c.takes[id].sacks, auto: c.takes[id].auto }));
      return { sources: c.card.items.map((i) => i.expenseId), sacks: c.sacks, takes, rest: cardStatus(c) === 'partial' || c.rest === 'farm' ? c.rest : null };
    });
  return { ...rest, lines, pct: s.pct, settle: s.settle };
}

/** Price per sack in full, satang only when there are any (D-96 (2)): 300, 1,250.50. */
export function fullPrice(satang: number): string {
  return formatSatang(satang).replace(/\.00$/, '');
}
