import { afterEach, describe, expect, it } from 'vitest';

import { NoGroupError } from '../core/scope';
import { NotSignedInError, sessionGroupId, sessionUserId, setSessionGroup, setSessionUser } from './session';

/**
 * E02-S01 AC2/AC6: nothing is recorded without a signed-in user, and what is
 * recorded carries that user's id. The write path reads the id from here.
 */
describe('session', () => {
  afterEach(() => {
    setSessionUser(null);
    setSessionGroup(null);
  });

  it('refuses to name a writer before anyone has signed in', () => {
    expect(() => sessionUserId()).toThrow(NotSignedInError);
  });

  it('names the signed-in user once there is one', () => {
    setSessionUser('uid-1');
    expect(sessionUserId()).toBe('uid-1');
  });

  it('refuses to name a group before one is open (E02-S02, D-24)', () => {
    setSessionUser('uid-1');
    expect(() => sessionGroupId()).toThrow(NoGroupError);
  });

  it('names the open group once the gate has entered one', () => {
    setSessionGroup('g1');
    expect(sessionGroupId()).toBe('g1');
  });
});
