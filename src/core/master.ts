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
import type { BuiltinRole, Crop, Gps, PersonId, SaleEvent } from './types';

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

export interface AreaEntry {
  readonly entryId: string;
  readonly centiRai: number;
  /** ISO day the area takes effect. */
  readonly effective: string;
  readonly recordedTs: number;
}

export interface PropertyRecord {
  readonly id: string;
  readonly name: string;
  readonly crop: Crop;
  readonly plantedYearBe: number | null;
  readonly gps: Gps | null;
  /** Newest effective date first; same date → recorded later first (D-65 Q8). */
  readonly areaHistory: readonly AreaEntry[];
  readonly deleted: boolean;
  readonly createdTs: number;
}

export interface MasterState {
  /** Including deleted ones — old records still resolve their names. */
  readonly people: readonly PersonRecord[];
  readonly buyers: readonly BuyerRecord[];
  readonly properties: readonly PropertyRecord[];
}

const byThaiName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'th');

export function projectMaster(events: readonly SaleEvent[]): MasterState {
  const people = new Map<string, PersonRecord>();
  const buyers = new Map<string, BuyerRecord>();
  const properties = new Map<string, PropertyRecord & { areas: AreaEntry[] }>();
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
      case 'property_added':
        properties.set(p.propertyId, {
          id: p.propertyId,
          name: p.name,
          crop: p.crop,
          plantedYearBe: p.plantedYearBe ?? null,
          gps: p.gps ?? null,
          areaHistory: [],
          areas: properties.get(p.propertyId)?.areas ?? [],
          deleted: false,
          createdTs: e.ts,
        });
        break;
      case 'property_edited': {
        const cur = properties.get(p.propertyId);
        if (!cur) break;
        const cleared = p.cleared ?? [];
        properties.set(p.propertyId, {
          ...cur,
          name: p.name ?? cur.name,
          crop: p.crop ?? cur.crop,
          plantedYearBe: cleared.includes('plantedYearBe') ? null : (p.plantedYearBe ?? cur.plantedYearBe),
          gps: cleared.includes('gps') ? null : (p.gps ?? cur.gps),
        });
        break;
      }
      case 'area_recorded': {
        const cur = properties.get(p.propertyId);
        // Fold order puts the create first, so an orphan entry is ignored.
        if (cur) cur.areas.push({ entryId: p.entryId, centiRai: p.centiRai, effective: p.effective, recordedTs: e.ts });
        break;
      }
    }
  }

  const gone = deletedIds(events);
  return {
    people: [...people.values()].map((x) => ({ ...x, deleted: gone.has(x.id) })).sort(byThaiName),
    buyers: [...buyers.values()].map((x) => ({ ...x, deleted: gone.has(x.id) })).sort(byThaiName),
    properties: [...properties.values()]
      .map(({ areas, ...x }) => ({
        ...x,
        // `areas` is in fold order, so for equal dates the later index was recorded later.
        areaHistory: areas
          .map((a, i) => ({ a, i }))
          .sort((x, y) => (x.a.effective === y.a.effective ? y.i - x.i : x.a.effective < y.a.effective ? 1 : -1))
          .map(({ a }) => a),
        deleted: gone.has(x.id),
      }))
      .sort(byThaiName),
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

/**
 * The property's area (centi-rai) in effect on `day` (ISO), or null when no
 * entry had taken effect yet — "ไม่ทราบ", never 0 (SYNC-12).
 */
export function areaOn(property: PropertyRecord, day: string): number | null {
  return property.areaHistory.find((a) => a.effective <= day)?.centiRai ?? null;
}

/** Age in whole years from a planted year in พ.ศ.; null when unknown. */
export function ageInYears(plantedYearBe: number | null, nowTs: number): number | null {
  if (plantedYearBe === null) return null;
  return new Date(nowTs + BANGKOK_OFFSET_MS).getUTCFullYear() + 543 - plantedYearBe;
}

export function validateProperty(draft: { name: string; crop: Crop | null }): ('name' | 'crop')[] {
  const errors: ('name' | 'crop')[] = [];
  if (!draft.name.trim()) errors.push('name');
  if (!draft.crop) errors.push('crop');
  return errors;
}

/** Rai as typed → centi-rai. Blank is allowed (unknown); otherwise a number > 0 (D-65 Q7). */
export function parseRai(text: string): { ok: true; centiRai: number | null } | { ok: false } {
  const t = text.trim();
  if (!t) return { ok: true, centiRai: null };
  if (!/^\d+(\.\d+)?$/.test(t)) return { ok: false };
  const centiRai = Math.round(Number(t) * 100);
  return centiRai > 0 ? { ok: true, centiRai } : { ok: false };
}

/** `d/m/yyyy` with the year in พ.ศ. (or ค.ศ. if < 2400) → ISO day; null if not a real date. */
export function parseThaiDay(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const year = y > 2400 ? y - 543 : y;
  const date = new Date(Date.UTC(year, mo - 1, d));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/** An ISO day as the user types it back: `d/m/yyyy` in พ.ศ. */
export function thaiDayInput(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${d}/${m}/${y + 543}`;
}

/** Today in Bangkok, as an ISO day. */
export function todayIso(nowTs: number): string {
  return new Date(nowTs + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** "lat, lng" in degrees → microdegrees; blank = none. */
export function parseGps(text: string): { ok: true; gps: Gps | null } | { ok: false } {
  const t = text.trim();
  if (!t) return { ok: true, gps: null };
  const parts = t.split(',').map((x) => Number(x.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return { ok: false };
  const [lat, lng] = parts;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false };
  return { ok: true, gps: { latE6: Math.round(lat * 1e6), lngE6: Math.round(lng * 1e6) } };
}

export function formatGps(gps: Gps): string {
  return `${(gps.latE6 / 1e6).toFixed(4)}, ${(gps.lngE6 / 1e6).toFixed(4)}`;
}

/** Centi-rai for display: `125` or `12.5`. */
export function formatRai(centiRai: number): string {
  return String(centiRai / 100);
}
