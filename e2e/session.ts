import { FIXTURE_GROUP_ID } from '../src/core/fixtures';

/**
 * E02-S01/S02: every screen sits behind sign-in and an open farm group. The interaction suites are about
 * counting and settling, not about logging in, so they start from a device
 * that has already signed in — the account record the app keeps in
 * localStorage (`src/store/account.web.ts`), preloaded through Playwright's
 * `storageState`. Signing in itself is proven by `auth-emulator.spec.ts`
 * against the Firebase Auth emulator, and by the gate's component tests.
 */

export const BASE_URL = 'http://127.0.0.1:8080';

export const E2E_USER = {
  userId: 'e2e-user',
  displayName: 'ผู้ทดสอบ',
  identities: [{ provider: 'google', subject: 'e2e-google-sub' }],
};

const account = (memberships: unknown[]) => ({
  cookies: [],
  origins: [
    {
      origin: BASE_URL,
      localStorage: [
        { name: 'mon-farm:account', value: JSON.stringify({ user: E2E_USER, memberships, pendingOps: [] }) },
      ],
    },
  ],
});

/** Signed in, one farm group — the group the fixtures' events are recorded in. */
export const signedIn = account([{ groupId: FIXTURE_GROUP_ID, name: 'สวนทดสอบ', role: 'owner' }]);

/** Signed in, no farm group yet (E02-S02). */
export const signedInNoGroup = account([]);

/** A browser that has never signed in — for the login screen itself. */
export const signedOut = { cookies: [], origins: [] };
