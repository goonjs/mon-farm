import { describe, expect, it } from 'vitest';

import { BE_OFFSET, clockSeconds, dateParts } from './thai-date';

// 2026-10-09 18:30 UTC = 2026-10-10 01:30 in Bangkok.
const lateEvening = Date.UTC(2026, 9, 9, 18, 30);

describe('dateParts (D-74 F14)', () => {
  it('Buddhist Era is the Common Era year + 543', () => {
    expect(BE_OFFSET).toBe(543);
    expect(dateParts(Date.UTC(2026, 0, 15, 5), 'be')).toEqual({ day: 15, month: 1, year: 2569 });
    expect(dateParts(Date.UTC(2026, 0, 15, 5), 'ce')).toEqual({ day: 15, month: 1, year: 2026 });
  });

  it('is the date on the farm (Bangkok), whatever the device timezone', () => {
    expect(dateParts(lateEvening, 'ce')).toEqual({ day: 10, month: 10, year: 2026 });
  });

  it('crosses the new year at Bangkok midnight', () => {
    expect(dateParts(Date.UTC(2026, 11, 31, 16, 59), 'be')).toEqual({ day: 31, month: 12, year: 2569 });
    expect(dateParts(Date.UTC(2026, 11, 31, 17, 0), 'be')).toEqual({ day: 1, month: 1, year: 2570 });
  });
});

describe('clockSeconds (E04-S15)', () => {
  it('is the time on the farm to the second: HH:MM:SS, zero-padded', () => {
    expect(clockSeconds(Date.UTC(2026, 9, 3, 0, 46, 12))).toBe('07:46:12');
    expect(clockSeconds(Date.UTC(2026, 9, 3, 1, 5, 9))).toBe('08:05:09');
  });

  it('crosses Bangkok midnight, whatever the device timezone', () => {
    expect(clockSeconds(Date.UTC(2026, 9, 3, 16, 59, 59))).toBe('23:59:59');
    expect(clockSeconds(Date.UTC(2026, 9, 3, 17, 0, 0))).toBe('00:00:00');
  });

  it('drops the milliseconds, never rounds up into the next second', () => {
    expect(clockSeconds(Date.UTC(2026, 9, 3, 0, 0, 0, 999))).toBe('07:00:00');
  });
});
