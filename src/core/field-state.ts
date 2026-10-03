/**
 * How complete one field's data is (SYNC-12, E01-S15) — the one central
 * type every story uses; none defines its own.
 *
 * A field is a value paired with its state. The two "no value" states carry
 * `null`, never 0: "nobody knows the tree count" and "the tree count is 0"
 * are different facts, and a calculation must not turn the first into the
 * second (NFR-3). Changing a state (Estimated → User provided) is an ordinary
 * edit event (SYNC-9). Thai labels live in the i18n catalogue
 * (`dataState.*`), the badge in `src/components/DataStateBadge.tsx`.
 */

export const FIELD_DATA_STATES = [
  'unknown',
  'not-recorded',
  'estimated',
  'user-provided',
  'system-calculated',
  'ai-suggested',
] as const;

export type FieldDataState = (typeof FIELD_DATA_STATES)[number];

/** The two states that carry no value. Decided by the state, never by the value. */
export function isNoValue(state: FieldDataState): state is 'unknown' | 'not-recorded' {
  return state === 'unknown' || state === 'not-recorded';
}

/** Any value except null/undefined: "no value" is a state, not a value. */
type Present = NonNullable<unknown>;

export type FieldValue<T extends Present> =
  | { readonly value: null; readonly state: 'unknown' | 'not-recorded' }
  | { readonly value: T; readonly state: 'estimated' | 'user-provided' | 'system-calculated' | 'ai-suggested' };

/** Nobody knows the value. */
export const unknown = (): FieldValue<never> => ({ value: null, state: 'unknown' });
/** The value was never captured (it may have been knowable). */
export const notRecorded = (): FieldValue<never> => ({ value: null, state: 'not-recorded' });
export const estimated = <T extends Present>(value: T): FieldValue<T> => ({ value, state: 'estimated' });
export const provided = <T extends Present>(value: T): FieldValue<T> => ({ value, state: 'user-provided' });
export const calculated = <T extends Present>(value: T): FieldValue<T> => ({ value, state: 'system-calculated' });
/** Needs review before anyone relies on it (AI suggested / Needs Review). */
export const aiSuggested = <T extends Present>(value: T): FieldValue<T> => ({ value, state: 'ai-suggested' });

/**
 * The value, or null when there is none — never a stand-in 0. Fields also
 * arrive as untyped JSON (the log, sync, later LINE/AI), so this trusts the
 * state over whatever sits in `value`.
 */
export function valueOf<T extends Present>(field: FieldValue<T>): T | null {
  if (isNoValue(field.state)) return null;
  return field.value ?? null;
}

/**
 * Adds the fields that have a value. `missing` counts the ones that do not,
 * so a screen can say "incomplete" instead of showing a smaller total as if
 * it were whole. `total` is null when no field has a value (including an
 * empty list — `missing: 0` tells that case apart). Estimated and AI-suggested
 * values are included; a caller that must exclude unreviewed values filters
 * by state first.
 */
export function sumKnown(fields: readonly FieldValue<number>[]): { total: number | null; missing: number } {
  let total: number | null = null;
  let missing = 0;
  for (const f of fields) {
    const v = valueOf(f);
    if (v === null || !Number.isFinite(v)) missing += 1;
    else total = (total ?? 0) + v;
  }
  return { total, missing };
}
