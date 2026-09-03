/**
 * Native farm profile store: expo-sqlite, same database file as events
 * (`store.native.ts`) and people (`people.native.ts`), two more tables.
 * Opening the same db name from multiple modules is safe — SQLite supports
 * multiple connections to one file, and each module's
 * `CREATE TABLE IF NOT EXISTS` only ever touches its own table(s). The
 * `events` table is not touched.
 *
 * Kept as its own pair of tables rather than folded into `events` because a
 * profile zone/pile is not sale-scoped: it is reused across many sales, and
 * the `events` table's `PRIMARY KEY (sale_id, seq)` has no meaning for a
 * record that outlives any one sale.
 */

import * as SQLite from 'expo-sqlite';

import { newId } from '../lib/id';
import type { PileId, ZoneId } from '../core/types';
import type { FarmStore, ProfilePile, ProfileZone } from './farm';

const DB_NAME = 'mon-farm.db';

interface ZoneRow {
  id: string;
  name: string;
  archived_ts: number | null;
}

interface PileRow {
  id: string;
  zone_id: string;
  name: string;
  tare_g: number;
  std_net_g: number;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS farm_zones (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    archived_ts INTEGER
  );
  CREATE TABLE IF NOT EXISTS farm_piles (
    id          TEXT PRIMARY KEY,
    zone_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    tare_g      INTEGER NOT NULL,
    std_net_g   INTEGER NOT NULL
  );
`;

function fromPileRow(r: PileRow): ProfilePile {
  return { id: r.id, name: r.name, tareG: r.tare_g, stdNetG: r.std_net_g };
}

export class SqliteFarmStore implements FarmStore {
  private db: SQLite.SQLiteDatabase | null = null;

  private async open(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.db.execAsync(SCHEMA);
    }
    return this.db;
  }

  private async assemble(db: SQLite.SQLiteDatabase, row: ZoneRow): Promise<ProfileZone> {
    const pileRows = await db.getAllAsync<PileRow>(`SELECT * FROM farm_piles WHERE zone_id = ?`, row.id);
    return { id: row.id, name: row.name, archivedTs: row.archived_ts, piles: pileRows.map(fromPileRow) };
  }

  async listZones(): Promise<ProfileZone[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<ZoneRow>(
      `SELECT * FROM farm_zones WHERE archived_ts IS NULL ORDER BY name COLLATE NOCASE`,
    );
    return Promise.all(rows.map((r) => this.assemble(db, r)));
  }

  async getZone(id: ZoneId): Promise<ProfileZone | null> {
    const db = await this.open();
    const row = await db.getFirstAsync<ZoneRow>(`SELECT * FROM farm_zones WHERE id = ?`, id);
    return row ? this.assemble(db, row) : null;
  }

  async addZone(name: string): Promise<ProfileZone> {
    const db = await this.open();
    const zone: ProfileZone = { id: newId('zone-'), name, piles: [], archivedTs: null };
    await db.runAsync(`INSERT INTO farm_zones (id, name, archived_ts) VALUES (?, ?, NULL)`, zone.id, zone.name);
    return zone;
  }

  async renameZone(id: ZoneId, name: string): Promise<void> {
    const db = await this.open();
    await db.runAsync(`UPDATE farm_zones SET name = ? WHERE id = ?`, name, id);
  }

  async archiveZone(id: ZoneId): Promise<void> {
    const db = await this.open();
    await db.runAsync(`UPDATE farm_zones SET archived_ts = ? WHERE id = ?`, Date.now(), id);
  }

  async addPile(zoneId: ZoneId, name: string, tareG: number, stdNetG: number): Promise<ProfilePile> {
    const db = await this.open();
    const pile: ProfilePile = { id: newId('pile-'), name, tareG, stdNetG };
    await db.runAsync(
      `INSERT INTO farm_piles (id, zone_id, name, tare_g, std_net_g) VALUES (?, ?, ?, ?, ?)`,
      pile.id,
      zoneId,
      pile.name,
      pile.tareG,
      pile.stdNetG,
    );
    return pile;
  }

  async editPile(
    zoneId: ZoneId,
    pileId: PileId,
    patch: Partial<Pick<ProfilePile, 'name' | 'tareG' | 'stdNetG'>>,
  ): Promise<void> {
    const db = await this.open();
    const current = await db.getFirstAsync<PileRow>(
      `SELECT * FROM farm_piles WHERE id = ? AND zone_id = ?`,
      pileId,
      zoneId,
    );
    if (!current) return;
    const next = { ...fromPileRow(current), ...patch };
    await db.runAsync(
      `UPDATE farm_piles SET name = ?, tare_g = ?, std_net_g = ? WHERE id = ? AND zone_id = ?`,
      next.name,
      next.tareG,
      next.stdNetG,
      pileId,
      zoneId,
    );
  }

  async removePile(zoneId: ZoneId, pileId: PileId): Promise<void> {
    const db = await this.open();
    await db.runAsync(`DELETE FROM farm_piles WHERE id = ? AND zone_id = ?`, pileId, zoneId);
  }
}

export const farmStore: FarmStore = new SqliteFarmStore();
