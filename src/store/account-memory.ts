/**
 * In-memory `AccountStore`, in its own file for the same jest-expo
 * platform-resolution reason as `farm-memory.ts`.
 */

import type { CreateGroupOp, Membership } from '../core/group';
import type { User } from '../core/user';
import type { AccountStore } from './account';

export class MemoryAccountStore implements AccountStore {
  private current: User | null = null;
  private groups: Membership[] = [];
  private ops: CreateGroupOp[] = [];

  async user(): Promise<User | null> {
    return this.current;
  }

  async saveUser(user: User): Promise<void> {
    this.current = user;
  }

  async memberships(): Promise<Membership[]> {
    return [...this.groups];
  }

  async createGroup(membership: Membership, op: CreateGroupOp): Promise<void> {
    this.groups = [...this.groups, membership];
    this.ops = [...this.ops, op];
  }

  async pendingOps(): Promise<CreateGroupOp[]> {
    return [...this.ops];
  }
}
