import { describe, expect, it } from 'vitest';

import { NoGroupError, requireGroupId } from './scope';

/** D-24: every event belongs to a farm group from the very first one. */
describe('requireGroupId', () => {
  it('passes a group id through', () => {
    expect(requireGroupId('g1')).toBe('g1');
  });

  it.each([undefined, null, ''])('refuses %j — no event exists outside a group', (bad) => {
    expect(() => requireGroupId(bad)).toThrow(NoGroupError);
  });
});
