/**
 * The account port: who is signed in on this device (E02-S01), and which
 * farm groups they belong to (E02-S02).
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

import type { CreateGroupOp, Membership } from '../core/group';
import type { User } from '../core/user';

export interface AccountStore {
  /** The signed-in user, or null before the first sign-in on this device. */
  user(): Promise<User | null>;
  saveUser(user: User): Promise<void>;
  /**
   * The groups this device's user belongs to, as last known on the device —
   * what the app opens into, offline included (ACC-3, ACC-6).
   */
  memberships(): Promise<Membership[]>;
  /**
   * Keeps a group created on this device: the membership row and the
   * pending `create_group` op, written together or not at all. Rejects when
   * it cannot be kept, so nothing is reported as created that a reload
   * would lose.
   */
  createGroup(membership: Membership, op: CreateGroupOp): Promise<void>;
  /** Server writes not yet sent — drained by the outbox (E01-S09, not built). */
  pendingOps(): Promise<CreateGroupOp[]>;
}

/** Ambient declaration only — see the matching note in `store.ts`. */
export declare const accountStore: AccountStore;
