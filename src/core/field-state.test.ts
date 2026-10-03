import { describe, expect, it } from 'vitest';

import {
  FIELD_DATA_STATES,
  type FieldValue,
  aiSuggested,
  calculated,
  estimated,
  notRecorded,
  provided,
  sumKnown,
  unknown,
  valueOf,
} from './field-state';

describe('FieldDataState — SYNC-12, one central type (E01-S15)', () => {
  it('has exactly the six states', () => {
    expect([...FIELD_DATA_STATES].sort()).toEqual(
      ['ai-suggested', 'estimated', 'not-recorded', 'system-calculated', 'unknown', 'user-provided'].sort(),
    );
  });

  it('pairs a value with its state, and the two "no value" states carry no value', () => {
    expect(provided(12)).toEqual({ value: 12, state: 'user-provided' });
    expect(estimated(12)).toEqual({ value: 12, state: 'estimated' });
    expect(calculated(12)).toEqual({ value: 12, state: 'system-calculated' });
    expect(aiSuggested(12)).toEqual({ value: 12, state: 'ai-suggested' });
    expect(unknown()).toEqual({ value: null, state: 'unknown' });
    expect(notRecorded()).toEqual({ value: null, state: 'not-recorded' });
  });

  it('keeps a real 0 apart from "no value" (NFR-3)', () => {
    expect(valueOf(provided(0))).toBe(0);
    expect(valueOf(unknown())).toBeNull();
    expect(valueOf(notRecorded())).toBeNull();
  });
});

describe('sumKnown — "no value" is never counted as 0', () => {
  it('adds only fields that have a value and says how many were missing', () => {
    expect(sumKnown([provided(10), unknown(), estimated(5), notRecorded(), provided(0)])).toEqual({
      total: 15,
      missing: 2,
    });
  });

  it('trusts the state over the value for data arriving as untyped JSON', () => {
    const malformed = [
      { state: 'unknown', value: 0 },
      { state: 'not-recorded', value: 7 },
      { state: 'estimated' },
    ] as unknown as FieldValue<number>[];
    expect(sumKnown([...malformed, provided(4)])).toEqual({ total: 4, missing: 3 });
    expect(valueOf(malformed[0])).toBeNull();
  });

  it('has no total at all when nothing is known — not a total of 0', () => {
    expect(sumKnown([unknown(), notRecorded()])).toEqual({ total: null, missing: 2 });
    expect(sumKnown([])).toEqual({ total: null, missing: 0 });
  });
});
