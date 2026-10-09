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

export interface PointRecord {
  readonly id: string;
  readonly propertyId: string;
  readonly name: string;
  /** Deleted itself. */
  readonly deleted: boolean;
  /** Not offered anywhere: deleted itself, or its farm is (D-65 Q9). */
  readonly hidden: boolean;
  /** Shares its name with another shown point in the same farm — two devices offline (D-65). */
  readonly duplicateName: boolean;
  readonly createdTs: number;
}

/** One dated change of a point's tapper; `tapperId` null = no tapper from then. */
export interface AssignmentChange {
  readonly assignmentId: string;
  readonly pointId: string;
  readonly tapperId: PersonId | null;
  /** ISO day; null = no start date (covers all of the past). */
  readonly from: string | null;
  /** Cancelled plan (soft delete). */
  readonly deleted: boolean;
}

export interface MasterState {
  /** In fold order — the tie-breaker for two changes on the same day. */
  readonly assignments: readonly AssignmentChange[];
  /** Including deleted ones — old records still resolve their names. */
  readonly people: readonly PersonRecord[];
  readonly buyers: readonly BuyerRecord[];
  readonly properties: readonly PropertyRecord[];
  readonly points: readonly PointRecord[];
}

const byThaiName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'th');

export function projectMaster(events: readonly SaleEvent[]): MasterState {
  const people = new Map<string, PersonRecord>();
  const buyers = new Map<string, BuyerRecord>();
  const properties = new Map<string, PropertyRecord & { areas: AreaEntry[] }>();
  const points = new Map<string, { id: string; propertyId: string; name: string; createdTs: number }>();
  const changes: Omit<AssignmentChange, 'deleted'>[] = [];
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
      case 'point_added':
        points.set(p.pointId, { id: p.pointId, propertyId: p.propertyId, name: p.name, createdTs: e.ts });
        break;
      case 'point_renamed': {
        const cur = points.get(p.pointId);
        if (cur) points.set(p.pointId, { ...cur, name: p.name });
        break;
      }
      case 'tapper_assigned':
        changes.push({ assignmentId: p.assignmentId, pointId: p.pointId, tapperId: p.tapperId, from: p.from ?? null });
        break;
      case 'tapper_unassigned':
        changes.push({ assignmentId: p.assignmentId, pointId: p.pointId, tapperId: null, from: p.from });
        break;
    }
  }

  const gone = deletedIds(events);
  const pointList = [...points.values()].map((x) => ({
    ...x,
    deleted: gone.has(x.id),
    hidden: gone.has(x.id) || gone.has(x.propertyId),
  }));
  const shownNames = new Map<string, number>();
  for (const x of pointList) if (!x.hidden) shownNames.set(nameKey(x.propertyId, x.name), (shownNames.get(nameKey(x.propertyId, x.name)) ?? 0) + 1);
  return {
    assignments: changes.map((c) => ({ ...c, deleted: gone.has(c.assignmentId) })),
    points: pointList
      .map((x) => ({ ...x, duplicateName: !x.hidden && (shownNames.get(nameKey(x.propertyId, x.name)) ?? 0) > 1 }))
      .sort(byThaiName),
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

const nameKey = (propertyId: string, name: string) => `${propertyId}\u0000${name.trim()}`;

/** Points that can be offered: not deleted, and their farm not deleted either. */
export function activePoints(state: MasterState, propertyId?: string): PointRecord[] {
  return state.points.filter((p) => !p.hidden && (propertyId === undefined || p.propertyId === propertyId));
}

/** Is `name` already used by a shown point of this farm (other than `exceptId`)? (D-65 Q10) */
export function pointNameTaken(state: MasterState, propertyId: string, name: string, exceptId?: string): boolean {
  const key = name.trim();
  return activePoints(state, propertyId).some((p) => p.id !== exceptId && p.name.trim() === key);
}

/**
 * The starter-structure button: only while the group has no points in use
 * (deleted ones do not count — they cannot be duplicated), and only once this device has pulled the group's data, so a phone that has
 * not yet seen another phone's points cannot create a second set.
 */
export function showStarterButton(state: MasterState, firstPullDone: boolean): boolean {
  return firstPullDone && activePoints(state).length === 0;
}

export interface StarterRow {
  readonly propertyId: string;
  readonly tapperId: string;
  /** One per point, typed by the user — never made up (D-73). */
  readonly names: readonly string[];
}

export type StarterPlan =
  | { ok: true; points: { propertyId: string; tapperId: string; name: string }[] }
  | { ok: false; missing: number; duplicates: string[] };

/**
 * The generic set-up wizard's plan (D-73): farm → tappers → how many points
 * each → their names. Nothing farm-specific lives in code; every name is
 * the user's, and a name may not repeat within a farm (D-65 Q10).
 */
export function planStarterPoints(state: MasterState, rows: readonly StarterRow[]): StarterPlan {
  const points = rows.flatMap((r) => r.names.map((name) => ({ propertyId: r.propertyId, tapperId: r.tapperId, name: name.trim() })));
  const missing = points.filter((p) => !p.name).length;
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const p of points.filter((x) => x.name)) {
    const k = nameKey(p.propertyId, p.name);
    if (seen.has(k) || pointNameTaken(state, p.propertyId, p.name)) duplicates.add(p.name);
    seen.add(k);
  }
  return missing || duplicates.size ? { ok: false, missing, duplicates: [...duplicates] } : { ok: true, points };
}

/**
 * A point's live changes, earliest first: no start date first, then by day;
 * on the same day the change later in fold order comes last, so it wins.
 */
function liveChanges(state: MasterState, pointId: string): AssignmentChange[] {
  return state.assignments
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.pointId === pointId && !c.deleted)
    .sort((a, b) => {
      const fa = a.c.from ?? '';
      const fb = b.c.from ?? '';
      return fa === fb ? a.i - b.i : fa < fb ? -1 : 1;
    })
    .map(({ c }) => c);
}

/** The point's tapper on `day`, or null — "ยังไม่มีคนกรีด" (SALE-4). */
export function tapperOn(state: MasterState, pointId: string, day: string): PersonId | null {
  let who: PersonId | null = null;
  for (const c of liveChanges(state, pointId)) if (c.from === null || c.from <= day) who = c.tapperId;
  return who;
}

export interface TimelineSegment {
  readonly assignmentId: string;
  readonly tapperId: PersonId;
  readonly from: string | null;
  /** Inclusive last day; null = still in effect. The day before the next change (D-63). */
  readonly to: string | null;
}

/** Who had the point when — vacancies are the gaps between segments. */
export function pointTimeline(state: MasterState, pointId: string): TimelineSegment[] {
  const live = liveChanges(state, pointId);
  // A change superseded on its own start day never took effect.
  const effective = live.filter((c, i) => live[i + 1]?.from !== c.from);
  return effective.flatMap((c, i) => {
    if (c.tapperId === null) return [];
    const next = effective[i + 1];
    return [{ assignmentId: c.assignmentId, tapperId: c.tapperId, from: c.from, to: next?.from ? dayBefore(next.from) : null }];
  });
}

/** The shown points a person is the tapper of on `day` (D-65). */
export function pointsOf(state: MasterState, tapperId: PersonId, day: string): PointRecord[] {
  return activePoints(state).filter((p) => tapperOn(state, p.id, day) === tapperId);
}

/** The ISO day before `day`. */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * The point's tapper on `day` as a person who can still tap: null when none
 * is assigned, or the assigned person was deleted or lost the tapper role —
 * the point then reads "ยังไม่มีคนกรีด" (E03-S01 AC4, D-65). The assignment
 * itself is untouched, so restoring the person restores the point.
 */
export function activeTapperOn(state: MasterState, pointId: string, day: string): PersonRecord | null {
  const id = tapperOn(state, pointId, day);
  const person = id ? state.people.find((p) => p.id === id) : undefined;
  return person && !person.deleted && person.roles.includes('tapper') ? person : null;
}
