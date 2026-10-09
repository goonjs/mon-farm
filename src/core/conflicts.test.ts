import { describe, expect, it } from 'vitest';

import { blockingConflicts, foldRecord, resolution, type ChangeNode } from './conflicts';

// One basket record: created, then changed on two phones.
const create: ChangeNode = { id: 'c', targetId: 'b1', baseEventId: null, patch: { netG: 50_000, note: '' } };
const change = (id: string, base: string, patch: Record<string, unknown>, also?: string[]): ChangeNode => ({
  id,
  targetId: 'b1',
  baseEventId: base,
  alsoBasedOn: also,
  patch,
});

describe('foldRecord — one line of history', () => {
  it('a create alone is its own head and value', () => {
    const r = foldRecord([create]);
    expect(r.value).toEqual({ netG: 50_000, note: '' });
    expect(r.heads).toEqual(['c']);
    expect(r.conflicts).toEqual([]);
  });

  it('changes that follow each other fold in order, whatever order they arrive in', () => {
    const r = foldRecord([change('e2', 'e1', { netG: 52_000 }), create, change('e1', 'c', { netG: 51_000 })]);
    expect(r.value.netG).toBe(52_000);
    expect(r.heads).toEqual(['e2']);
  });
});

describe('foldRecord — two phones edit the same base (D-30)', () => {
  it('different descriptive fields merge on their own', () => {
    const r = foldRecord([
      { ...create, patch: { netG: 50_000, note: '', buyer: 'x' } },
      change('a', 'c', { note: 'wet' }),
      change('b', 'c', { buyer: 'y' }),
    ]);
    expect(r.conflicts).toEqual([]);
    expect(r.value).toMatchObject({ note: 'wet', buyer: 'y', netG: 50_000 });
  });

  it('the same field with different values is a conflict, even a note — no last-write-wins', () => {
    const r = foldRecord([create, change('a', 'c', { note: 'wet' }), change('b', 'c', { note: 'dry' })]);
    expect(r.conflicts).toEqual([
      { targetId: 'b1', field: 'note', base: '', options: [{ eventId: 'a', value: 'wet' }, { eventId: 'b', value: 'dry' }] },
    ]);
    expect(r.value.note).toBe('');
  });

  it('a weight changed on two phones shows the base value, flagged, never one of the edits (NFR-3)', () => {
    const r = foldRecord([create, change('a', 'c', { netG: 51_000 }), change('b', 'c', { netG: 49_000 })]);
    expect(r.value.netG).toBe(50_000);
    expect(r.conflicts.map((c) => c.field)).toEqual(['netG']);
  });

  it('a strict field is a conflict even when the other phone changed a different field', () => {
    const r = foldRecord([create, change('a', 'c', { netG: 51_000 }), change('b', 'c', { note: 'wet' })]);
    expect(r.conflicts).toEqual([
      { targetId: 'b1', field: 'netG', base: 50_000, options: [{ eventId: 'a', value: 51_000 }] },
    ]);
    expect(r.value).toMatchObject({ netG: 50_000, note: 'wet' });
  });

  it('identical edits merge', () => {
    const r = foldRecord([create, change('a', 'c', { netG: 51_000 }), change('b', 'c', { netG: 51_000 })]);
    expect(r.conflicts).toEqual([]);
    expect(r.value.netG).toBe(51_000);
  });

  it('delete on one phone and edit on another is a conflict; meanwhile not deleted, pre-edit value', () => {
    const r = foldRecord([create, change('a', 'c', { deleted: true }), change('b', 'c', { note: 'wet' })]);
    expect(r.conflicts.map((c) => c.field).sort()).toEqual(['deleted', 'note']);
    expect(r.value).toMatchObject({ note: '' });
    expect(r.value.deleted).toBeUndefined();
  });

  it('delete and delete merge', () => {
    const r = foldRecord([create, change('a', 'c', { deleted: true }), change('b', 'c', { deleted: true })]);
    expect(r.conflicts).toEqual([]);
    expect(r.value.deleted).toBe(true);
  });
});

describe('resolve (E01-S11 AC3)', () => {
  const forked = [create, change('a', 'c', { netG: 51_000 }), change('b', 'c', { netG: 49_000 })];

  it('one resolve naming every head ends the conflict', () => {
    const r = foldRecord(forked);
    const fix = resolution(r, { netG: 51_000 });
    expect(fix).toEqual({ targetId: 'b1', baseEventId: 'a', alsoBasedOn: ['b'], patch: { netG: 51_000 } });
    const after = foldRecord([...forked, { id: 'r', ...fix }]);
    expect(after.conflicts).toEqual([]);
    expect(after.value.netG).toBe(51_000);
    expect(after.heads).toEqual(['r']);
  });

  it('keeping the base value is a choice too', () => {
    const r = foldRecord(forked);
    const after = foldRecord([...forked, { id: 'r', ...resolution(r, { netG: r.conflicts[0].base }) }]);
    expect(after.value.netG).toBe(50_000);
    expect(after.conflicts).toEqual([]);
  });

  it('two phones resolving differently offline is a new conflict', () => {
    const r = foldRecord(forked);
    const after = foldRecord([
      ...forked,
      { id: 'r1', ...resolution(r, { netG: 51_000 }) },
      { id: 'r2', ...resolution(r, { netG: 49_000 }) },
    ]);
    expect(after.conflicts.map((c) => c.field)).toEqual(['netG']);
    expect(after.value.netG).toBe(50_000);
  });

  it('an edit after an auto-merge that names both heads continues one line', () => {
    const merged = [create, change('a', 'c', { note: 'wet' }), change('b', 'c', { buyer: 'y' })];
    const r = foldRecord([...merged, change('d', 'a', { note: 'dry' }, ['b'])]);
    expect(r.heads).toEqual(['d']);
    expect(r.value).toMatchObject({ note: 'dry', buyer: 'y' });
  });
});

describe('out of order (architecture: change before its base)', () => {
  it('a change whose base has not arrived waits, showing the last known value', () => {
    const r = foldRecord([create, change('e2', 'e1', { netG: 52_000 })]);
    expect(r.waiting).toBe(true);
    expect(r.value.netG).toBe(50_000);
  });
});

describe('blockingConflicts', () => {
  it('lists every open conflict in a sale, descriptive fields included', () => {
    const records = [
      foldRecord([create, change('a', 'c', { note: 'wet' }), change('b', 'c', { note: 'dry' })]),
      foldRecord([{ ...create, id: 'c2', targetId: 'b2' }]),
    ];
    expect(blockingConflicts(records).map((c) => [c.targetId, c.field])).toEqual([['b1', 'note']]);
  });
});
