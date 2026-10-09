import { describe, expect, it } from 'vitest';

import { failureFromCode } from './errors';

/**
 * How a failed Google sign-in reads to the person (docs/ux/flows/
 * e02-access-and-sync-states.md §2.2): no network and a blocked popup each
 * have their own message, closing the window is not an error, and anything
 * else is a plain "try again".
 */
describe('failureFromCode', () => {
  it('no network is "offline" — the first sign-in needs the internet (E02-S01 AC3)', () => {
    expect(failureFromCode('auth/network-request-failed')).toBe('offline');
  });

  it('closing the Google window is a cancel, not an error', () => {
    expect(failureFromCode('auth/popup-closed-by-user')).toBe('cancelled');
    expect(failureFromCode('auth/cancelled-popup-request')).toBe('cancelled');
    expect(failureFromCode('auth/user-cancelled')).toBe('cancelled');
  });

  it('a blocked popup is its own case', () => {
    expect(failureFromCode('auth/popup-blocked')).toBe('popup-blocked');
  });

  it('anything else, including no code at all, is a generic failure', () => {
    expect(failureFromCode('auth/internal-error')).toBe('failed');
    expect(failureFromCode(undefined)).toBe('failed');
  });
});
