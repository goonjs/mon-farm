/**
 * The account port (E02-S01): who is signed in on this device.
 *
 * The signed-in user is kept on the device rather than read from Firebase
 * Auth at launch, so reopening the app in airplane mode never depends on an
 * auth SDK restoring its own state, nor on an ID token that may have expired
 * offline (ACC-6, AC7). Firebase is only how someone signs in; this is what
 * says they did. There is no sign-out in the MVP (D-23), so nothing clears it.
 *
 * Same port/adapter shape as `farm.ts` / `people.ts`:
 *   account.web.ts    — localStorage, one JSON document
 *   account.native.ts — expo-sqlite, `meta` in `mon-farm-v1.db`
 *   account-memory.ts — tests
 */

import type { User } from '../core/user';

export interface AccountStore {
  /** The signed-in user, or null before the first sign-in on this device. */
  user(): Promise<User | null>;
  saveUser(user: User): Promise<void>;
}

/** Ambient declaration only — see the matching note in `store.ts`. */
export declare const accountStore: AccountStore;
