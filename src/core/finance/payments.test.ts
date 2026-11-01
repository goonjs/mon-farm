import { describe, expect, it } from 'vitest';

import { paymentMarkPayload, paymentStatus, paymentTarget, salePaymentConflicts } from './payments';
import type { FinanceEvent, FinancePayload } from './types';

let n = 0;
function ev(targetId: string, payload: FinancePayload, base: string | null = null, device = 'dev-a', ts = 1_770_000_000_000 + n): FinanceEvent {
  n += 1;
  return { id: `p${String(n).padStart(4, '0')}`, groupId: 'group-1', deviceSeq: n, ts, actor: { userId: 'u', deviceId: device }, source: 'app', targetId, baseEventId: base, payload };
}

const T = paymentTarget('s1', 'person-daeng');

describe('separate payment statuses (E05-S05 · SET-6)', () => {
  it('nothing ticked → not paid, nothing to recheck', () => {
    expect(paymentStatus([], 's1', 'person-daeng', 3486000)).toMatchObject({ done: false, recheck: false, conflict: false, head: null });
  });

  it('ticking keeps the amount it was ticked at, who, when and which phone', () => {
    const a = ev(T, paymentMarkPayload('s1', 'person-daeng', true, 3486000), null, 'dev-b', 1_770_000_123_000);
    expect(paymentStatus([a], 's1', 'person-daeng', 3486000)).toEqual({
      done: true,
      amountAtMarkSatang: 3486000,
      receivedSatang: 3486000,
      shortSatang: 0,
      recheck: false,
      conflict: false,
      head: a.id,
      heads: [a.id],
      by: { userId: 'u', deviceId: 'dev-b' },
      at: 1_770_000_123_000,
    });
  });

  it('the amount changes after it was ticked (an edit to the sale) → "ต้องตรวจใหม่" with old and new (SALE-21)', () => {
    const a = ev(T, paymentMarkPayload('s1', 'person-daeng', true, 3486000));
    expect(paymentStatus([a], 's1', 'person-daeng', 3436000)).toMatchObject({ done: true, recheck: true, amountAtMarkSatang: 3486000 });
    // Only that payee: another worker's tick is untouched.
    const b = ev(paymentTarget('s1', 'person-nat'), paymentMarkPayload('s1', 'person-nat', true, 1782375));
    expect(paymentStatus([a, b], 's1', 'person-nat', 1782375).recheck).toBe(false);
  });

  it('ticking again at the new amount clears the flag; unticking is a new event', () => {
    const a = ev(T, paymentMarkPayload('s1', 'person-daeng', true, 3486000));
    const b = ev(T, paymentMarkPayload('s1', 'person-daeng', true, 3436000), a.id);
    expect(paymentStatus([a, b], 's1', 'person-daeng', 3436000)).toMatchObject({ done: true, recheck: false });
    const c = ev(T, paymentMarkPayload('s1', 'person-daeng', false, 3436000), b.id);
    expect(paymentStatus([a, b, c], 's1', 'person-daeng', 3436000)).toMatchObject({ done: false, recheck: false, head: c.id });
  });

  it('two phones tick the same → merges; tick vs untick → conflict', () => {
    const a = ev(T, paymentMarkPayload('s1', 'person-daeng', true, 3486000), null, 'dev-a');
    const b = ev(T, paymentMarkPayload('s1', 'person-daeng', true, 3486000), null, 'dev-b');
    expect(paymentStatus([a, b], 's1', 'person-daeng', 3486000)).toMatchObject({ done: true, conflict: false });
    const c = ev(T, paymentMarkPayload('s1', 'person-daeng', false, 3486000), a.id, 'dev-b');
    const d = ev(T, paymentMarkPayload('s1', 'person-daeng', true, 3486000), a.id, 'dev-a');
    const r = paymentStatus([a, c, d], 's1', 'person-daeng', 3486000);
    expect(r).toMatchObject({ conflict: true, done: false });
    expect(r.heads).toEqual([c.id, d.id].sort());
    expect(salePaymentConflicts([a, c, d], 's1')).toEqual(['person-daeng']);
    expect(salePaymentConflicts([a, c, d], 's2')).toEqual([]);
  });

  it('review #2: two phones ticked at different amounts → recheck if any tick is not at today\'s amount', () => {
    const old = ev(T, paymentMarkPayload('s1', 'person-daeng', true, 3486000), null, 'dev-a');
    const now = ev(T, paymentMarkPayload('s1', 'person-daeng', true, 3436000), null, 'dev-b');
    expect(paymentStatus([old, now], 's1', 'person-daeng', 3436000)).toMatchObject({ done: true, recheck: true, conflict: false });
    expect(paymentStatus([now, old], 's1', 'person-daeng', 3436000).recheck).toBe(true);
  });

  it('review #5: a write based on both conflicting heads settles it', () => {
    const a = ev(T, paymentMarkPayload('s1', 'person-daeng', true, 3486000), null, 'dev-a');
    const b = ev(T, paymentMarkPayload('s1', 'person-daeng', false, 3486000), null, 'dev-b');
    expect(paymentStatus([a, b], 's1', 'person-daeng', 3486000).conflict).toBe(true);
    const c = ev(T, { ...paymentMarkPayload('s1', 'person-daeng', false, 3486000), alsoBasedOn: [a.id] }, b.id);
    expect(paymentStatus([a, b, c], 's1', 'person-daeng', 3486000)).toMatchObject({ conflict: false, done: false, heads: [c.id] });
  });
});

describe('received amount on a tick (E06-S08 PR-15/PR-18 · D-87)', () => {
  const O = paymentTarget('s1', 'owner');

  it('no receivedSatang = received in full (old ticks read as before)', () => {
    const a = ev(O, paymentMarkPayload('s1', 'owner', true, 1968750));
    expect(a.payload).not.toHaveProperty('receivedSatang');
    expect(paymentStatus([a], 's1', 'owner', 1968750)).toMatchObject({ done: true, receivedSatang: 1968750, shortSatang: 0 });
  });

  it('received less → the short part is what the buyer still owes the farm', () => {
    const a = ev(O, paymentMarkPayload('s1', 'owner', true, 1968750, 1700000));
    expect(paymentStatus([a], 's1', 'owner', 1968750)).toMatchObject({ done: true, receivedSatang: 1700000, shortSatang: 268750 });
  });

  it('0 = recorded as not received at all', () => {
    const a = ev(paymentTarget('s1', 'debt-cash-person-daeng'), paymentMarkPayload('s1', 'debt-cash-person-daeng', true, 325000, 0));
    expect(paymentStatus([a], 's1', 'debt-cash-person-daeng', 325000)).toMatchObject({ done: true, receivedSatang: 0, shortSatang: 325000 });
  });

  it('received ≥ amount is stored as "full" (no field); negative or fractional is refused', () => {
    expect(paymentMarkPayload('s1', 'owner', true, 1000, 1000)).not.toHaveProperty('receivedSatang');
    expect(() => paymentMarkPayload('s1', 'owner', true, 1000, 1200)).toThrow();
    expect(() => paymentMarkPayload('s1', 'owner', true, 1000, -1)).toThrow();
    expect(() => paymentMarkPayload('s1', 'owner', true, 1000, 1.5)).toThrow();
  });

  it('not ticked → nothing received, nothing short', () => {
    expect(paymentStatus([], 's1', 'owner', 1000)).toMatchObject({ receivedSatang: null, shortSatang: 0 });
  });

  it('two phones record a different received amount → conflict, never the last head silently (PR-18)', () => {
    const a = ev(O, paymentMarkPayload('s1', 'owner', true, 1968750), null, 'dev-a');
    const b = ev(O, paymentMarkPayload('s1', 'owner', true, 1968750, 1700000), null, 'dev-b');
    expect(paymentStatus([a, b], 's1', 'owner', 1968750)).toMatchObject({ conflict: true, done: false });
    expect(salePaymentConflicts([a, b], 's1')).toEqual(['owner']);
    // The same received amount from both merges.
    const c = ev(O, paymentMarkPayload('s1', 'owner', true, 1968750, 1700000), null, 'dev-c');
    expect(paymentStatus([b, c], 's1', 'owner', 1968750)).toMatchObject({ conflict: false, done: true, shortSatang: 268750 });
  });
});
