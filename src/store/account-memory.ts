/**
 * In-memory `AccountStore`, in its own file for the same jest-expo
 * platform-resolution reason as `farm-memory.ts`.
 */

import type { User } from '../core/user';
import type { AccountStore } from './account';

export class MemoryAccountStore implements AccountStore {
  private current: User | null = null;

  async user(): Promise<User | null> {
    return this.current;
  }

  async saveUser(user: User): Promise<void> {
    this.current = user;
  }
}
