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
