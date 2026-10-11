/**
 * Sign-in failures, in an unsuffixed file with no platform sibling for the
 * same reason as `src/store/errors.ts`: both `google.web.ts` and
 * `google.native.ts` throw these, and the login screen matches on them.
 */

/** What the person is told (docs/ux/flows/e02-access-and-sync-states.md §2.2). */
export type SignInFailure = 'offline' | 'cancelled' | 'popup-blocked' | 'failed';

export class SignInError extends Error {
  constructor(
    readonly reason: SignInFailure,
    options?: { cause?: unknown },
  ) {
    super(`Sign-in failed: ${reason}.`, options);
    this.name = 'SignInError';
  }
}

/** Maps a Firebase Auth error code to what the person is told. */
export function failureFromCode(code: string | undefined): SignInFailure {
  switch (code) {
    case 'auth/network-request-failed':
      return 'offline';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return 'cancelled';
    case 'auth/popup-blocked':
      return 'popup-blocked';
    default:
      return 'failed';
  }
}
