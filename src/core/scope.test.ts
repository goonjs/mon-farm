import { describe, expect, it } from 'vitest';

import { belongsTo, NoGroupError, requireGroupId, waitingCount } from './scope';

/** D-24: every event belongs to a farm group from the very first one. */
describe('requireGroupId', () => {
  it('passes a group id through', () => {
    expect(requireGroupId('g1')).toBe('g1');
  });

  it.each([undefined, null, ''])('refuses %j — no event exists outside a group', (bad) => {
    expect(() => requireGroupId(bad)).toThrow(NoGroupError);
  });
});

/** E01-S09: what a signed-in user in an open group may send, and what counts as waiting. */
describe('belongsTo / waitingCount', () => {
  const scope = { userId: 'u1', groupId: 'g1' };
  const event = (userId: string, groupId?: string) => ({ groupId, actor: { userId } });
  const op = (createdBy: string, groupId: string) => ({ createdBy, groupId });

  it('an event belongs to the user who wrote it in the group that was open', () => {
    expect(belongsTo(scope, event('u1', 'g1'))).toBe(true);
  });

  it.each([
    ['another user', event('u2', 'g1')],
    ['another group', event('u1', 'g2')],
    ['no group (recorded before groups existed)', event('u1', undefined)],
    ['an empty group', event('u1', '')],
  ])('%s does not', (_name, e) => {
    expect(belongsTo(scope, e)).toBe(false);
  });

  it("counts only this user's events and group-creations in this group", () => {
    const events = [event('u1', 'g1'), event('u1', 'g1'), event('u2', 'g1'), event('u1', 'g2')];
    const ops = [op('u1', 'g1'), op('u2', 'g1'), op('u1', 'g2')];
    expect(waitingCount(scope, events, ops)).toBe(3);
    expect(waitingCount(scope, [], [])).toBe(0);
  });
});
