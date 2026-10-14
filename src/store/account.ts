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
 *   account.web.ts    — IndexedDB `mon-farm-v1`: `meta`, `memberships`, `pendingOps`
 *   account.native.ts — expo-sqlite `mon-farm-v1.db`: `meta`, `memberships`, `pending_ops`
 *   account-memory.ts — tests
 */

import type { CreateGroupOp, Membership } from '../core/group';
import type { User } from '../core/user';

export interface AccountStore {
  /** The signed-in user, or null before the first sign-in on this device. */
  user(): Promise<User | null>;
  saveUser(user: User): Promise<void>;
  /**
   * The groups kept on this device, each tagged with the `userId` it belongs
   * to — the gate opens only the signed-in user's (`decideEntry`), offline
   * included (ACC-3, ACC-6).
   */
  memberships(): Promise<Membership[]>;
  /**
   * Keeps a group created on this device: the membership row and the
   * pending `create_group` op, written together or not at all. Rejects when
   * it cannot be kept, so nothing is reported as created that a reload
   * would lose.
   */
  createGroup(membership: Membership, op: CreateGroupOp): Promise<void>;
  /**
   * Keeps groups the server says this user belongs to (E02-S05: a returning
   * member on a new device). An upsert by `groupId`, all in one transaction, and
   * no `create_group` op: the group already exists on the server. Rejects when
   * it cannot be kept, so the app never enters a group a reload would forget.
   */
  saveMemberships(memberships: readonly Membership[]): Promise<void>;
  /** Server writes not yet sent — drained by the sync engine, before that group's events (E01-S09). */
  pendingOps(): Promise<CreateGroupOp[]>;
  /**
   * The server confirmed `op`: forget it. The membership stays. Completing an
   * op that is already gone is a no-op, so a repeated drain is harmless.
   */
  completeOp(op: CreateGroupOp): Promise<void>;
}

/** Ambient declaration only — see the matching note in `store.ts`. */
export declare const accountStore: AccountStore;
