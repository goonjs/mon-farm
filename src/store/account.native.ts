/**
 * Native account store: expo-sqlite, `mon-farm-v1.db` (architecture §Schema
 * — native): the signed-in user in `meta` key `session` (same table as the
 * event store's device counter; each module only touches its own key), and
 * the `memberships` / `pending_ops` tables, written in one transaction when
 * a group is created.
 *
 * Written but not yet exercised on a device — native has never run (E01-S06).
 */

import * as SQLite from 'expo-sqlite';

import type { CreateGroupOp, Membership, Role } from '../core/group';
import type { User } from '../core/user';
import type { AccountStore } from './account';

const DB_NAME = 'mon-farm-v1.db';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS memberships (group_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
                                          role TEXT NOT NULL, member_count INTEGER, state TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS pending_ops (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, op TEXT NOT NULL,
                                          body TEXT NOT NULL, error TEXT);
`;

export class SqliteAccountStore implements AccountStore {
  private db: Promise<SQLite.SQLiteDatabase> | null = null;

  private open(): Promise<SQLite.SQLiteDatabase> {
    this.db ??= (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(SCHEMA);
      return db;
    })();
    return this.db;
  }

  async user(): Promise<User | null> {
    const db = await this.open();
    const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM meta WHERE key = 'session'`);
    return row ? (JSON.parse(row.value) as User) : null;
  }

  async saveUser(user: User): Promise<void> {
    const db = await this.open();
    await db.runAsync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('session', ?)`, JSON.stringify(user));
  }

  async memberships(): Promise<Membership[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<{ group_id: string; user_id: string; name: string; role: Role }>(
      `SELECT group_id, user_id, name, role FROM memberships WHERE state = 'active' ORDER BY rowid`,
    );
    return rows.map((r) => ({ groupId: r.group_id, userId: r.user_id, name: r.name, role: r.role }));
  }

  async createGroup(membership: Membership, op: CreateGroupOp): Promise<void> {
    const db = await this.open();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT INTO memberships (group_id, user_id, name, role, member_count, state) VALUES (?, ?, ?, ?, 1, 'active')`,
        membership.groupId,
        membership.userId,
        membership.name,
        membership.role,
      );
      await tx.runAsync(
        `INSERT INTO pending_ops (id, group_id, op, body) VALUES (?, ?, ?, ?)`,
        `${op.op}:${op.groupId}`,
        op.groupId,
        op.op,
        JSON.stringify(op),
      );
    });
  }

  async saveMemberships(memberships: readonly Membership[]): Promise<void> {
    const db = await this.open();
    await db.withExclusiveTransactionAsync(async (tx) => {
      for (const m of memberships) {
        // Upsert, but keep what the row already knows (member count, state) — only the name and role come from the server.
        await tx.runAsync(
          `INSERT INTO memberships (group_id, user_id, name, role, member_count, state) VALUES (?, ?, ?, ?, NULL, 'active')
           ON CONFLICT(group_id) DO UPDATE SET name = excluded.name, role = excluded.role`,
          m.groupId,
          m.userId,
          m.name,
          m.role,
        );
      }
    });
  }

  async pendingOps(): Promise<CreateGroupOp[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<{ body: string }>(`SELECT body FROM pending_ops ORDER BY rowid`);
    return rows.map((r) => JSON.parse(r.body) as CreateGroupOp);
  }

  async completeOp(op: CreateGroupOp): Promise<void> {
    const db = await this.open();
    await db.runAsync(`DELETE FROM pending_ops WHERE id = ?`, `${op.op}:${op.groupId}`);
  }
}

export const accountStore: AccountStore = new SqliteAccountStore();
