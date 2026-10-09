import { describe, expect, it } from 'vitest';

import { LogBuilder } from '../core/fixtures';
import { resolve } from '../i18n/resolve';
import { overallBadge, overallLabel, saleLabel, saleSyncState } from './status';

const sale = new LogBuilder('s1', 'dev-A').accept('p1').accept('p1').accept('p1').build();
const ids = sale.map((e) => e.id);
const none = new Set<string>();

describe('saleSyncState (E01-S10 AC2/AC3)', () => {
  it('everything sent → synced', () => {
    expect(saleSyncState(sale, none)).toBe('synced');
  });

  it('any basket still in the outbox → pending', () => {
    expect(saleSyncState(sale, new Set([ids[1]]))).toBe('pending');
  });

  it('a send error outranks pending', () => {
    expect(saleSyncState(sale, new Set(ids), { errorIds: new Set([ids[0]]) })).toBe('error');
  });

  it('a conflict outranks everything', () => {
    expect(
      saleSyncState(sale, new Set(ids), { errorIds: new Set([ids[0]]), conflictIds: new Set([ids[2]]) }),
    ).toBe('conflict');
  });

  it('ids from other sales do not count', () => {
    expect(saleSyncState(sale, new Set(['other']), { conflictIds: new Set(['x']) })).toBe('synced');
  });
});

describe('overallBadge (AC1, AC5)', () => {
  it('synced: no count, no retry', () => {
    expect(overallBadge({ state: 'synced', pending: 0 }, 0)).toEqual({ kind: 'synced', showRetry: false });
  });

  it('offline or waiting to send is pending with a count, never an error', () => {
    expect(overallBadge({ state: 'pending', pending: 4 }, 0)).toEqual({ kind: 'pending', count: 4, showRetry: false });
  });

  it('offline with nothing to send stays synced', () => {
    expect(overallBadge({ state: 'pending', pending: 0 }, 0).kind).toBe('synced');
  });

  it('an error offers retry', () => {
    expect(overallBadge({ state: 'error', pending: 2, error: 'denied' }, 0)).toEqual({ kind: 'error', showRetry: true });
  });

  it('conflicts win, with their count and a retry/resolve action', () => {
    expect(overallBadge({ state: 'error', pending: 2, error: 'denied' }, 3)).toEqual({
      kind: 'conflict',
      count: 3,
      showRetry: true,
    });
  });
});

describe('Thai labels (design-system §7, owner 2026-10-03)', () => {
  const th = (id: Parameters<typeof resolve>[1], vars?: Record<string, string | number>) => resolve('th', id, vars);

  it('header', () => {
    expect(th(...overallLabel({ kind: 'synced', showRetry: false }))).toBe('ซิงก์แล้ว');
    expect(th(...overallLabel({ kind: 'pending', count: 4, showRetry: false }))).toBe('รอส่ง 4');
    expect(th(...overallLabel({ kind: 'conflict', count: 2, showRetry: true }))).toBe('ขัดกัน 2');
    expect(th(...overallLabel({ kind: 'error', showRetry: true }))).toBe('ส่งไม่สำเร็จ · ลองใหม่');
  });

  it('per sale, no numbers', () => {
    expect(th(saleLabel('synced'))).toBe('ซิงก์แล้ว');
    expect(th(saleLabel('pending'))).toBe('รอส่ง');
    expect(th(saleLabel('conflict'))).toBe('ข้อมูลขัดกัน');
    expect(th(saleLabel('error'))).toBe('ส่งไม่สำเร็จ');
  });

  it('retry button', () => {
    expect(th('sync.retry')).toBe('ลองใหม่');
  });
});
