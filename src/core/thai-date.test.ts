import { describe, expect, it } from 'vitest';

import { BE_OFFSET, dateParts } from './thai-date';

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
