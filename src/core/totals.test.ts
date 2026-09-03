import { describe, expect, it } from 'vitest';

import { LogBuilder, readyPile, setUpSale } from './fixtures';
import { pileTotals } from './totals';

/**
 * The short half of `pileTotals`, pinned.
 *
 * `shortBaskets`/`shortNetG` have been correct since S4, but nothing asserted
 * them directly — they were only ever exercised through `settle()`'s worked
 * example. S22 puts both numbers on two screens, so the fold they come from
 * gets its own regression cover here rather than being trusted second-hand:
 * if the sum, the void handling or the zero case ever changes, the failure
 * should name `pileTotals`, not a screen.
 */

const pile = (b: LogBuilder) => pileTotals(b.build(), 'p1');

describe('pileTotals — short baskets', () => {
  it('sums every short basket in the pile, not just the last one', () => {
    const b = readyPile(setUpSale(new LogBuilder()), 'p1');
    b.accept('p1'); // 50 kg standard
    b.short('p1', 14_400); // 14.4 − 2 = 12.4 kg
    b.short('p1', 10_000); // 10 − 2 =  8.0 kg

    const t = pile(b);
    expect(t.shortBaskets).toBe(2);
    expect(t.shortNetG).toBe(20_400);
    expect(t.standardNetG).toBe(50_000);
    expect(t.netG).toBe(70_400);
  });

  it('drops a short basket a correction voided, from the count and the weight', () => {
    const b = readyPile(setUpSale(new LogBuilder()), 'p1');
    b.short('p1', 14_400); // 12.4 kg
    const undone = b.nextSeq();
    b.short('p1', 10_000); // 8.0 kg — the one undone below
    b.void('p1', undone, 'กดพลาด');

    const t = pile(b);
    expect(t.shortBaskets).toBe(1);
    expect(t.shortNetG).toBe(12_400);
  });

  it('is zero on both counts for a pile nobody has shorted', () => {
    const b = readyPile(setUpSale(new LogBuilder()), 'p1');
    b.accept('p1');

    const t = pile(b);
    expect(t.shortBaskets).toBe(0);
    expect(t.shortNetG).toBe(0);
  });

  it('counts only the pile asked for', () => {
    const b = readyPile(setUpSale(new LogBuilder()), 'p1');
    readyPile(b, 'p2');
    b.short('p1', 14_400); // 12.4 kg
    b.short('p2', 10_000); // 8.0 kg

    expect(pileTotals(b.build(), 'p1').shortNetG).toBe(12_400);
    expect(pileTotals(b.build(), 'p2').shortNetG).toBe(8_000);
  });
});

/**
 * S23: bulk-entered baskets are baskets. The `source` on an `accept` is
 * evidence about how the number was obtained, and nothing in the money chain
 * may read it — `totals.ts` is unchanged by that story, and these cases are
 * what keeps it that way.
 */
describe('pileTotals — bulk-entered piles settle identically (S23)', () => {
  it('a pile of bulk accepts totals exactly like the same pile counted live', () => {
    const live = readyPile(setUpSale(new LogBuilder()), 'p1');
    for (let i = 0; i < 12; i++) live.accept('p1');

    const bulk = setUpSale(new LogBuilder()).sys({
      t: 'bulk_gate_skipped',
      pileId: 'p1',
      reason: 'นับไว้ในกระดาษ',
    });
    for (let i = 0; i < 12; i++) bulk.accept('p1', 50_000, 2_000, 'bulk');

    expect(pile(bulk)).toEqual(pile(live));
    expect(pile(bulk).standardBaskets).toBe(12);
    expect(pile(bulk).netG).toBe(600_000);
  });

  it("the leftover's short event weighs the same as a live short basket", () => {
    const b = setUpSale(new LogBuilder()).sys({
      t: 'bulk_gate_skipped',
      pileId: 'p1',
      reason: 'ไม่ได้เปิดแอป',
    });
    for (let i = 0; i < 12; i++) b.accept('p1', 50_000, 2_000, 'bulk');
    b.short('p1', 10_400); // 10.4 − 2 = 8.4 kg left over

    const t = pile(b);
    expect(t.shortBaskets).toBe(1);
    expect(t.shortNetG).toBe(8_400);
    expect(t.baskets).toBe(13);
    expect(t.netG).toBe(608_400);
  });

  it('a zero leftover writes no short event, and costs no special case here', () => {
    const b = setUpSale(new LogBuilder()).sys({
      t: 'bulk_gate_skipped',
      pileId: 'p1',
      reason: 'ไม่มีเศษ',
    });
    for (let i = 0; i < 3; i++) b.accept('p1', 50_000, 2_000, 'bulk');

    const t = pile(b);
    expect(t.shortBaskets).toBe(0);
    expect(t.shortNetG).toBe(0);
    expect(t.netG).toBe(150_000);
  });

  it('an all-leftover pile — no baskets at all — is just its short weight', () => {
    const b = setUpSale(new LogBuilder()).sys({
      t: 'bulk_gate_skipped',
      pileId: 'p1',
      reason: 'เหลือกองเดียว',
    });
    b.short('p1', 22_000); // 20 kg

    const t = pile(b);
    expect(t.standardBaskets).toBe(0);
    expect(t.baskets).toBe(1);
    expect(t.netG).toBe(20_000);
  });
});
