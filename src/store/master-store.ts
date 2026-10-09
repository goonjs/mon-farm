/**
 * Farm master data on the event log (E03-S01): people and buyers.
 *
 * Replaces S16's device-only people table. Every write is an event under
 * `MASTER_SCOPE` in the one `EventStore`, so it is durable the same way a
 * basket is and sits in the same outbox for E01-S09 to sync (SYNC-4). Reads
 * fold the log with `projectMaster` — nothing is stored twice.
 *
 * Unsuffixed and platform-free: it takes its `EventStore` and device clock
 * as arguments, so Vitest drives it over `MemoryStore` and the app binds it
 * to the platform store in `people.web.ts` / `people.native.ts`.
 */

import {
  MASTER_SCOPE,
  filterPeople,
  projectMaster,
  validatePerson,
  type BuyerRecord,
  type MasterState,
  type PeopleFilter,
  type PersonRecord,
} from '../core/master';
import { projectSale } from '../core/project';
import type { BuiltinRole, MasterPayload, PersonId, SaleEvent } from '../core/types';
import { uuidv7 } from '../lib/id';
import type { DeviceClock } from './device-clock';
import { PRE_LOGIN_USER_ID } from './session';
import type { EventStore } from './store';

export type Person = PersonRecord;
export type Buyer = BuyerRecord;

export interface PersonPatch {
  readonly name?: string;
  readonly roles?: readonly BuiltinRole[];
  readonly otherRoles?: readonly string[];
}

/** What a person picker needs; `MasterStore` is the one implementation. */
export interface PeopleStore {
  /** Active people, alphabetical in Thai, optionally holding `role`. */
  list(filter?: PeopleFilter): Promise<Person[]>;
  /** Including deleted — old records still resolve a name. */
  get(id: PersonId): Promise<Person | null>;
  create(name: string, roles: readonly BuiltinRole[], otherRoles?: readonly string[]): Promise<Person>;
  rename(id: PersonId, name: string): Promise<void>;
  edit(id: PersonId, patch: PersonPatch): Promise<void>;
  /** Soft delete (D-27): "ลบ — กู้คืนได้". */
  remove(id: string): Promise<void>;
  restore(id: string): Promise<void>;
}

export class PersonInvalidError extends Error {
  constructor(readonly fields: readonly ('name' | 'roles')[]) {
    super(`Person is missing: ${fields.join(', ')}`);
  }
}

export class MasterStore implements PeopleStore {
  constructor(
    private readonly events: EventStore,
    private readonly clock: DeviceClock,
  ) {}

  async state(): Promise<MasterState> {
    return projectMaster(await this.events.load(MASTER_SCOPE));
  }

  async list(filter: PeopleFilter = 'all'): Promise<Person[]> {
    return filterPeople((await this.state()).people, filter);
  }

  async get(id: PersonId): Promise<Person | null> {
    return (await this.state()).people.find((p) => p.id === id) ?? null;
  }

  async create(name: string, roles: readonly BuiltinRole[], otherRoles: readonly string[] = []): Promise<Person> {
    const draft = { name: name.trim(), roles: [...roles], otherRoles: clean(otherRoles) };
    const invalid = validatePerson(draft);
    if (invalid.length) throw new PersonInvalidError(invalid);
    const personId = uuidv7();
    await this.write({ t: 'person_added', personId, ...draft });
    return (await this.get(personId))!;
  }

  async rename(id: PersonId, name: string): Promise<void> {
    await this.edit(id, { name });
  }

  async edit(id: PersonId, patch: PersonPatch): Promise<void> {
    const cur = await this.get(id);
    if (!cur) return;
    const next = {
      name: patch.name?.trim() ?? cur.name,
      roles: patch.roles ? [...patch.roles] : [...cur.roles],
      otherRoles: patch.otherRoles ? clean(patch.otherRoles) : [...cur.otherRoles],
    };
    const invalid = validatePerson(next);
    if (invalid.length) throw new PersonInvalidError(invalid);
    // Only the fields that changed go in the patch, so a concurrent edit of a
    // different field on another phone can merge (D-30) once E01-S11 lands.
    await this.write({
      t: 'person_edited',
      personId: id,
      ...(next.name !== cur.name ? { name: next.name } : {}),
      ...(!sameList(next.roles, cur.roles) ? { roles: next.roles } : {}),
      ...(!sameList(next.otherRoles, cur.otherRoles) ? { otherRoles: next.otherRoles } : {}),
    });
  }

  async addBuyer(name: string): Promise<Buyer> {
    const buyerId = uuidv7();
    await this.write({ t: 'buyer_added', buyerId, name: name.trim() });
    return (await this.state()).buyers.find((b) => b.id === buyerId)!;
  }

  async renameBuyer(id: string, name: string): Promise<void> {
    await this.write({ t: 'buyer_edited', buyerId: id, name: name.trim() });
  }

  /**
   * The buyer the newest started sale picked from this list, or null when it
   * typed a name instead (MD-6). Pair with `defaultBuyer`, which also drops a
   * buyer deleted since.
   */
  async latestBuyerId(): Promise<string | null> {
    for (const id of await this.events.listSales()) {
      const sale = projectSale(await this.events.load(id), id);
      if (sale.parties && !sale.deleted) return sale.parties.buyerId ?? null;
    }
    return null;
  }

  async remove(id: string): Promise<void> {
    await this.append((base) => ({ ...base, kind: 'delete', targetId: id }));
  }

  async restore(id: string): Promise<void> {
    await this.append((base) => ({ ...base, kind: 'restore', targetId: id }));
  }

  private write(payload: MasterPayload): Promise<void> {
    return this.append((base) => ({ ...base, kind: 'master', payload }));
  }

  private async append(make: (base: Omit<SaleEvent, 'kind'>) => SaleEvent): Promise<void> {
    const deviceId = await this.clock.load();
    const log = await this.events.load(MASTER_SCOPE);
    await this.events.append(
      make({
        id: uuidv7(),
        saleId: MASTER_SCOPE,
        seq: log.reduce((max, e) => Math.max(max, e.seq), 0) + 1,
        deviceSeq: this.clock.take(),
        ts: Date.now(),
        mono: Math.round(typeof performance !== 'undefined' ? performance.now() : Date.now()),
        actor: { userId: PRE_LOGIN_USER_ID, deviceId },
        source: 'app',
      } as Omit<SaleEvent, 'kind'>),
    );
  }
}

function clean(list: readonly string[]): string[] {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))];
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
