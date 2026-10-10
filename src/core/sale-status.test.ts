import { describe, expect, it } from 'vitest';

import { LogBuilder } from './fixtures';
import { projectSale } from './project';
import { canComplete, isMoneyChange, MONEY_REASONS, paymentRecheck, statusCountsAsClosed } from './sale-status';

const start = (b: LogBuilder) =>
  b.sys({ t: 'sale_started', farmName: '', buyer: 'ล้ง', manager: '', workerLead: '', where: 'farm' });

describe('E04-S11 — sale status (SALE-20, SALE-21)', () => {
  it('a sale is a draft until it is marked completed or cancelled', () => {
    const b = start(new LogBuilder('s'));
    expect(projectSale(b.build(), 's').saleStatus).toBe('draft');
    b.sys({ t: 'sale_status_set', status: 'cancelled' });
    expect(projectSale(b.build(), 's').saleStatus).toBe('cancelled');
  });

  it('completed needs a price first, and only from draft (owner 2026-10-03)', () => {
    const b = start(new LogBuilder('s'));
    expect(canComplete(projectSale(b.build(), 's'))).toBe(false);
    b.sys({ t: 'price_set', satangPerKg: 4_850, indexRef: '' });
    expect(canComplete(projectSale(b.build(), 's'))).toBe(true);
    b.sys({ t: 'sale_status_set', status: 'completed' });
    expect(canComplete(projectSale(b.build(), 's'))).toBe(false);
  });

  it('cancelled is not soft delete: it stays listed, it just counts in no totals across sales (SYNC-10)', () => {
    const b = start(new LogBuilder('s')).sys({ t: 'sale_status_set', status: 'cancelled' });
    const s = projectSale(b.build(), 's');
    expect([s.deleted, s.saleStatus]).toEqual([false, 'cancelled']);
    expect(statusCountsAsClosed(s)).toBe(false);
  });

  it('completed counts as closed for later shares; the old sale_closed still does too', () => {
    const done = start(new LogBuilder('s')).sys({ t: 'price_set', satangPerKg: 1, indexRef: '' }).sys({ t: 'sale_status_set', status: 'completed' });
    expect(statusCountsAsClosed(projectSale(done.build(), 's'))).toBe(true);
    const closed = start(new LogBuilder('s')).sys({ t: 'sale_closed' });
    expect(statusCountsAsClosed(projectSale(closed.build(), 's'))).toBe(true);
    const cancelledAfterClose = start(new LogBuilder('s')).sys({ t: 'sale_closed' }).sys({ t: 'sale_status_set', status: 'cancelled' });
    expect(statusCountsAsClosed(projectSale(cancelledAfterClose.build(), 's'))).toBe(false);
  });

  it('what changes money: baskets, corrections, price, split — not a note', () => {
    expect(isMoneyChange({ kind: 'accept' })).toBe(true);
    expect(isMoneyChange({ kind: 'correction' })).toBe(true);
    expect(isMoneyChange({ kind: 'sys', payload: { t: 'price_set' } })).toBe(true);
    expect(isMoneyChange({ kind: 'sys', payload: { t: 'split_set' } })).toBe(true);
    expect(isMoneyChange({ kind: 'sys', payload: { t: 'sale_started' } })).toBe(false);
    expect(isMoneyChange({ kind: 'sys', payload: { t: 'speech_set' } })).toBe(false);
  });

  it('the preset reasons are the owner list; a money edit after completed flags payment for recheck', () => {
    expect(MONEY_REASONS).toEqual(['ชั่งผิด', 'ราคาผิด', 'ผู้ซื้อแจ้งยอดต่าง']);
    const b = start(new LogBuilder('s')).acceptAt('p1', 1).sys({ t: 'price_set', satangPerKg: 1, indexRef: '' });
    b.sys({ t: 'sale_status_set', status: 'completed' });
    expect(paymentRecheck(b.build())).toEqual([]);
    b.sys({ t: 'money_edit', reason: 'ชั่งผิด', targetId: b.build()[1].id });
    expect(paymentRecheck(b.build())).toMatchObject([{ reason: 'ชั่งผิด' }]);
  });
});
