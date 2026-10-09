/**
 * Farm master data, folded from the log (E03-S01): people and buyers.
 *
 * Every create, edit, delete and restore is an event, so a rename never
 * changes an id (MD-5) and a deleted record stays resolvable for old records
 * that name it (D-27). Like `projectSale`, the result depends only on the fold
 * order (`compareEvents`), never on the order rows arrived in.
 *
 * Concurrent edits from two devices are folded "last in fold order wins" for
 * now; detecting them as a Conflict is E01-S11's job (architecture §ตรวจ
 * Conflict), which will replace this rule for every record kind at once.
 */

import { compareEvents } from './order';
import { deletedIds } from './soft-delete';
import type { BuiltinRole, PersonId, SaleEvent } from './types';

/**
 * The scope master-data events are stored under, in place of a sale id. The
 * architecture's envelope has `saleId: null` for records outside a sale; the
 * current envelope's `saleId` is not nullable until E04-S01, and the stores
 * key by it, so one reserved value stands in. `listSales` leaves it out.
 */
export const MASTER_SCOPE = 'farm-master';

export const BUILTIN_ROLES: readonly BuiltinRole[] = ['tapper', 'worker', 'manager', 'payer', 'tenant', 'owner'];

export interface PersonRecord {
  readonly id: PersonId;
  readonly name: string;
  readonly roles: readonly BuiltinRole[];
  readonly otherRoles: readonly string[];
  readonly deleted: boolean;
  /** Wall clock of the create — display only. */
  readonly createdTs: number;
}

export interface BuyerRecord {
  readonly id: string;
  readonly name: string;
  readonly deleted: boolean;
  readonly createdTs: number;
}

export interface MasterState {
  /** Including deleted ones — old records still resolve their names. */
  readonly people: readonly PersonRecord[];
  readonly buyers: readonly BuyerRecord[];
}

const byThaiName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'th');

export function projectMaster(events: readonly SaleEvent[]): MasterState {
  const people = new Map<string, PersonRecord>();
  const buyers = new Map<string, BuyerRecord>();
  const ordered = events.filter((e) => e.kind === 'master').sort(compareEvents);

  for (const e of ordered) {
    if (e.kind !== 'master') continue;
    const p = e.payload;
    switch (p.t) {
      case 'person_added':
        people.set(p.personId, {
          id: p.personId,
          name: p.name,
          roles: [...p.roles],
          otherRoles: [...p.otherRoles],
          deleted: false,
          createdTs: e.ts,
        });
        break;
      case 'person_edited': {
        const cur = people.get(p.personId);
        if (!cur) break;
        people.set(p.personId, {
          ...cur,
          name: p.name ?? cur.name,
          roles: p.roles ? [...p.roles] : cur.roles,
          otherRoles: p.otherRoles ? [...p.otherRoles] : cur.otherRoles,
        });
        break;
      }
      case 'buyer_added':
        buyers.set(p.buyerId, { id: p.buyerId, name: p.name, deleted: false, createdTs: e.ts });
        break;
      case 'buyer_edited': {
        const cur = buyers.get(p.buyerId);
        if (cur) buyers.set(p.buyerId, { ...cur, name: p.name });
        break;
      }
    }
  }

  const gone = deletedIds(events);
  return {
    people: [...people.values()].map((x) => ({ ...x, deleted: gone.has(x.id) })).sort(byThaiName),
    buyers: [...buyers.values()].map((x) => ({ ...x, deleted: gone.has(x.id) })).sort(byThaiName),
  };
}

export type PeopleFilter = 'all' | BuiltinRole;

/** Active people, alphabetical, optionally only those holding `role` (D-74 F12). */
export function filterPeople(people: readonly PersonRecord[], filter: PeopleFilter): PersonRecord[] {
  return people.filter((p) => !p.deleted && (filter === 'all' || p.roles.includes(filter)));
}

/** Field names that block saving: a name, and at least one role (D-68). */
export function validatePerson(draft: {
  name: string;
  roles: readonly BuiltinRole[];
  otherRoles: readonly string[];
}): ('name' | 'roles')[] {
  const errors: ('name' | 'roles')[] = [];
  if (!draft.name.trim()) errors.push('name');
  if (draft.roles.length === 0 && !draft.otherRoles.some((r) => r.trim())) errors.push('roles');
  return errors;
}

/**
 * A new sale's default buyer: the one the latest sale used (MD-6) — and none
 * at all if that buyer has since been deleted, rather than quietly falling
 * back to an older one (D-65 Q6).
 */
export function defaultBuyer(state: MasterState, latestBuyerId: string | null): BuyerRecord | null {
  if (!latestBuyerId) return null;
  const b = state.buyers.find((x) => x.id === latestBuyerId);
  return b && !b.deleted ? b : null;
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const BANGKOK_OFFSET_MS = 7 * 3_600_000;

/**
 * `1 ต.ค. 2569` (Buddhist era, the default — D-65 Q1) or `1 ต.ค. 2026`.
 * Fixed to Bangkok time: the farm is in Thailand whatever the device says.
 */
export function formatThaiDate(ts: number, era: 'be' | 'ce'): string {
  const d = new Date(ts + BANGKOK_OFFSET_MS);
  const year = d.getUTCFullYear() + (era === 'be' ? 543 : 0);
  return `${d.getUTCDate()} ${THAI_MONTHS[d.getUTCMonth()]} ${year}`;
}
