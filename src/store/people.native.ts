/**
 * Native people store: expo-sqlite, same database file as events
 * (`store.native.ts`), a separate table. Opening the same db name from two
 * modules is safe — SQLite supports multiple connections to one file, and each
 * module's `CREATE TABLE IF NOT EXISTS` only ever touches its own table.
 *
 * Kept as its own file/table rather than folded into `events` because people
 * are not sale-scoped: the same person is picked across many sales, and the
 * `events` table's `PRIMARY KEY (sale_id, seq)` has no meaning for a record
 * that outlives any one sale.
 */

import * as SQLite from 'expo-sqlite';

import { newId } from '../lib/id';
import type { PersonId } from '../core/types';
import type { PeopleStore, Person } from './people';

const DB_NAME = 'mon-farm.db';

interface Row {
  id: string;
  name: string;
  created_ts: number;
  archived_ts: number | null;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS people (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_ts  INTEGER NOT NULL,
    archived_ts INTEGER
  );
`;

function fromRow(r: Row): Person {
  return { id: r.id, name: r.name, createdTs: r.created_ts, archivedTs: r.archived_ts };
}

export class SqlitePeopleStore implements PeopleStore {
  private db: SQLite.SQLiteDatabase | null = null;

  private async open(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.db.execAsync(SCHEMA);
    }
    return this.db;
  }

  async list(): Promise<Person[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<Row>(
      `SELECT * FROM people WHERE archived_ts IS NULL ORDER BY name COLLATE NOCASE`,
    );
    return rows.map(fromRow);
  }

  async get(id: PersonId): Promise<Person | null> {
    const db = await this.open();
    const row = await db.getFirstAsync<Row>(`SELECT * FROM people WHERE id = ?`, id);
    return row ? fromRow(row) : null;
  }

  async create(name: string): Promise<Person> {
    const db = await this.open();
    const person: Person = { id: newId('person-'), name, createdTs: Date.now(), archivedTs: null };
    await db.runAsync(
      `INSERT INTO people (id, name, created_ts, archived_ts) VALUES (?, ?, ?, NULL)`,
      person.id,
      person.name,
      person.createdTs,
    );
    return person;
  }

  async rename(id: PersonId, name: string): Promise<void> {
    const db = await this.open();
    await db.runAsync(`UPDATE people SET name = ? WHERE id = ?`, name, id);
  }

  async archive(id: PersonId): Promise<void> {
    const db = await this.open();
    await db.runAsync(`UPDATE people SET archived_ts = ? WHERE id = ?`, Date.now(), id);
  }
}

export const peopleStore: PeopleStore = new SqlitePeopleStore();
