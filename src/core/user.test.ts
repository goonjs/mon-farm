import { describe, expect, it } from 'vitest';

import { linkIdentity, userFromSignIn, type Identity } from './user';

const google: Identity = { provider: 'google', subject: 'google-sub-1' };
const line: Identity = { provider: 'line', subject: 'line-sub-1' };

/**
 * E02-S01 (ACC-1): one logical user, many sign-in identities. The user id is
 * what events, memberships and rules key on; an identity is only a way in.
 */
describe('user model', () => {
  it('a first sign-in makes a user whose id is the auth uid, with that one identity', () => {
    const u = userFromSignIn('uid-1', 'สมชาย', google);
    expect(u).toEqual({ userId: 'uid-1', displayName: 'สมชาย', identities: [google] });
  });

  it('the same Google account on two devices is the same user', () => {
    const phone = userFromSignIn('uid-1', 'สมชาย', google);
    const laptop = userFromSignIn('uid-1', 'สมชาย', { ...google });
    expect(laptop.userId).toBe(phone.userId);
  });

  it('linking a second identity keeps the user and adds the identity', () => {
    const u = userFromSignIn('uid-1', 'สมชาย', google);
    const linked = linkIdentity(u, line);
    expect(linked.userId).toBe('uid-1');
    expect(linked.identities).toEqual([google, line]);
    expect(u.identities).toEqual([google]); // the original is not mutated
  });

  it('linking an identity that is already linked changes nothing', () => {
    const u = linkIdentity(userFromSignIn('uid-1', null, google), line);
    expect(linkIdentity(u, { provider: 'line', subject: 'line-sub-1' })).toBe(u);
  });
});
