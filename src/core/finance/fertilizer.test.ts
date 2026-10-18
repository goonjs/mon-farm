import { describe, expect, it } from 'vitest';

import { checkFertilizer, reasonLabel, TYPED_REASON } from './fertilizer';
import type { FertilizerDetails } from './types';

const BASE: FertilizerDetails = {
  type: 'chemical',
  formula: '15-15-15',
  brand: '',
  sackKg: 50,
  reasons: ['fopt-reason-บำรุงต้น', `${TYPED_REASON}ต้นโทรม`],
  zones: [],
  shop: '',
  orderedBy: '',
};

describe('checkFertilizer — what the purchase may store (E11-S10 C)', () => {
  it('a formula is required; zones may be left for later', () => {
    expect(checkFertilizer(BASE, 10)).toEqual([]);
    expect(checkFertilizer({ ...BASE, formula: '  ' }, 10)).toEqual(['formula-required']);
  });

  it('zone sacks are whole, and together never more than the sacks bought', () => {
    const z = (zoneId: string, sacks: number) => ({ zoneId, zoneName: zoneId, sacks, reasons: [], note: '' });
    expect(checkFertilizer({ ...BASE, zones: [z('a', 6), z('b', 4)] }, 10)).toEqual([]);
    expect(checkFertilizer({ ...BASE, zones: [z('a', 6), z('b', 5)] }, 10)).toEqual(['zones-over']);
    expect(checkFertilizer({ ...BASE, zones: [z('a', 1.5)] }, 10)).toEqual(['zone-sacks-not-whole']);
  });

  it('a zone names only reasons chosen for the purchase', () => {
    const zone = { zoneId: 'a', zoneName: 'a', sacks: 2, reasons: ['fopt-reason-อื่น'], note: '' };
    expect(checkFertilizer({ ...BASE, zones: [zone] }, 10)).toEqual(['zone-reason-unknown']);
  });

  it('a sack size, when known, is above 0', () => {
    expect(checkFertilizer({ ...BASE, sackKg: 0 }, 10)).toEqual(['sack-kg-invalid']);
    expect(checkFertilizer({ ...BASE, sackKg: null }, 10)).toEqual([]);
  });
});

describe('reasonLabel', () => {
  it('a saved reason reads its current name (even hidden); a typed one its text', () => {
    const options = [{ id: 'fopt-reason-บำรุงต้น', kind: 'reason' as const, name: 'บำรุงต้น', description: '', hidden: true }];
    expect(reasonLabel('fopt-reason-บำรุงต้น', options)).toBe('บำรุงต้น');
    expect(reasonLabel(`${TYPED_REASON}ต้นโทรม`, options)).toBe('ต้นโทรม');
    expect(reasonLabel('fopt-reason-gone', options)).toBe('gone');
  });
});
