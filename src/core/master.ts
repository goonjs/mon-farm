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
import type { BuiltinRole, Crop, Gps, NumberingMode, PersonId, SaleEvent, ScaleType, ZeroCheckMode } from './types';

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

export interface ShareEntry {
  readonly shareId: string;
  readonly tapperId: PersonId;
  readonly tapperPct: number;
  readonly from: string;
}

export interface BasketPair {
  readonly pairId: string;
  readonly netG: number;
  readonly basketG: number;
}

interface SettingsFold {
  readonly scaleType: ScaleType;
  readonly numbering: NumberingMode;
  readonly zeroCheck: ZeroCheckMode;
  readonly dupWindowS: number;
  /** Added pairs, in fold order, deleted ones included (filtered in `saleSettings`). */
  readonly added: readonly (BasketPair & { deleted: boolean })[];
  readonly defaultPairId: string | null;
}

export interface MasterState {
  readonly settings: SettingsFold;
  /** In fold order — same-day tie-breaker, like assignments. */
  readonly shares: readonly ShareEntry[];
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
  const shares: ShareEntry[] = [];
  let settings: Omit<SettingsFold, 'added'> = { scaleType: 'whole', numbering: 'per-tapper', zeroCheck: 'every', dupWindowS: 8, defaultPairId: null };
  const pairs: BasketPair[] = [];
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
      case 'share_set':
        shares.push({ shareId: p.shareId, tapperId: p.tapperId, tapperPct: p.tapperPct, from: p.from });
        break;
      case 'settings_set': {
        const { t: _t, ...patch } = p;
        settings = { ...settings, ...patch };
        break;
      }
      case 'basket_pair_added':
        pairs.push({ pairId: p.pairId, netG: p.netG, basketG: p.basketG });
        break;
      case 'basket_pair_default':
        settings = { ...settings, defaultPairId: p.pairId };
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
    settings: { ...settings, added: pairs.map((x) => ({ ...x, deleted: gone.has(x.pairId) })) },
    shares: shares.filter((x) => !gone.has(x.shareId)),
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

/** The farm by id, or null when there is none or it is deleted — a new point may go only under this. */
export function activeProperty(state: MasterState, id: string): PropertyRecord | null {
  return state.properties.find((p) => p.id === id && !p.deleted) ?? null;
}

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

export interface TapperPoint {
  readonly pointId: string;
  readonly name: string;
  readonly farmName: string;
  /** Their own segment on this point: from (null = no start date) to (inclusive, null = open). */
  readonly from: string | null;
  readonly to: string | null;
  /** A change on this point starts after `day` — "มีแผนเปลี่ยน". */
  readonly planned: boolean;
}

/** The points a tapper taps on `day`, for their detail screen (mockup v1.1.0 farm-05). */
export function tapperPointsNow(state: MasterState, tapperId: PersonId, day: string): TapperPoint[] {
  return pointsOf(state, tapperId, day).map((p) => {
    const timeline = pointTimeline(state, p.id);
    const mine = timeline.find((seg) => seg.tapperId === tapperId && (seg.from === null || seg.from <= day) && (seg.to === null || seg.to >= day));
    const planned = timeline.some((seg) => seg.from !== null && seg.from > day) || plannedVacancies(state, p.id, day).length > 0;
    return {
      pointId: p.id,
      name: p.name,
      farmName: state.properties.find((f) => f.id === p.propertyId)?.name ?? '',
      from: mine?.from ?? null,
      to: mine?.to ?? null,
      planned,
    };
  });
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

/** A tapper's share entries, newest effective first; same day → later in fold order first. */
export function shareHistory(state: MasterState, tapperId: PersonId): ShareEntry[] {
  return state.shares
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => x.tapperId === tapperId)
    .sort((a, b) => (a.x.from === b.x.from ? b.i - a.i : a.x.from < b.x.from ? 1 : -1))
    .map(({ x }) => x);
}

export interface Share {
  readonly tapperPct: number;
  readonly ownerPct: number;
  /** Nothing was ever set: 50/50 (MD-8). */
  readonly isDefault: boolean;
}

/** The tapper's share of gross on `day`. A change never reaches back before its start. */
export function shareOn(state: MasterState, tapperId: PersonId, day: string): Share {
  const entry = shareHistory(state, tapperId).find((x) => x.from <= day);
  const tapperPct = entry?.tapperPct ?? 50;
  return { tapperPct, ownerPct: 100 - tapperPct, isDefault: !entry };
}

/** The tapper's side as typed: a whole number 0–100 (D-63 Q17). */
export function parseTapperPct(text: string): { ok: true; tapperPct: number } | { ok: false; reason: 'whole' | 'range' } {
  const t = text.trim();
  if (/^-\d+$/.test(t)) return { ok: false, reason: 'range' };
  if (!/^\d+$/.test(t)) return { ok: false, reason: 'whole' };
  const n = Number(t);
  return n <= 100 ? { ok: true, tapperPct: n } : { ok: false, reason: 'range' };
}

/** The first day a new share may start: the day after the latest closed sale (D-74 F17), or any day. */
export function earliestShareDay(lastClosedSaleDay: string | null): string | null {
  return lastClosedSaleDay ? dayAfter(lastClosedSaleDay) : null;
}

export function shareFromAllowed(from: string, lastClosedSaleDay: string | null): boolean {
  const earliest = earliestShareDay(lastClosedSaleDay);
  return !earliest || from >= earliest;
}

/** The two standard nets every group starts with (MD-7); their basket weights follow the v1.1.0 mockup. */
const BUILTIN_PAIRS: readonly BasketPair[] = [
  { pairId: 'builtin-50', netG: 50_000, basketG: 2_000 },
  { pairId: 'builtin-60', netG: 60_000, basketG: 3_000 },
];

export interface SaleSettings {
  readonly scaleType: ScaleType;
  readonly numbering: NumberingMode;
  readonly zeroCheck: ZeroCheckMode;
  readonly dupWindowS: number;
  /** Exactly one is the default for a new sale. */
  readonly pairs: readonly (BasketPair & { isDefault: boolean })[];
}

/**
 * The group's sale settings with defaults filled in. A new sale snapshots
 * these when it starts (E04-S02); changing them later never touches a basket
 * already recorded.
 */
export function saleSettings(state: MasterState): SaleSettings {
  const { added, defaultPairId, ...rest } = state.settings;
  const live = [...BUILTIN_PAIRS, ...added.filter((p) => !p.deleted).map(({ deleted: _d, ...p }) => p)];
  const def = live.find((p) => p.pairId === defaultPairId) ?? live[0];
  return { ...rest, pairs: live.map((p) => ({ ...p, isDefault: p.pairId === def?.pairId })) };
}

/** Duplicate-count window, whole seconds 7–10 (SYNC-6). */
export function validDupWindow(s: number): boolean {
  return Number.isInteger(s) && s >= 7 && s <= 10;
}

/** Hold time, ms, 0.5–1 s (D-7). */
export function validHoldMs(ms: number): boolean {
  return Number.isInteger(ms) && ms >= 500 && ms <= 1000;
}

/** A pair in whole kg (whole-kg scale, D-66): net above 0, basket 0 or more. */
export function validPairKg(netKg: number, basketKg: number): boolean {
  return Number.isInteger(netKg) && netKg > 0 && Number.isInteger(basketKg) && basketKg >= 0;
}

/**
 * A change with no start date reaches back over all of the past, so it is
 * only for a point's first assignment; after that a change needs a day and
 * goes forward (D-63) — otherwise it would rewrite who tapped before.
 */
export function blankStartAllowed(state: MasterState, pointId: string): boolean {
  return liveChanges(state, pointId).length === 0;
}

/** "No tapper from X" changes not yet started — listed so they can be cancelled (D-74 F3). */
export function plannedVacancies(state: MasterState, pointId: string, today: string): { assignmentId: string; from: string }[] {
  return liveChanges(state, pointId)
    .filter((c) => c.tapperId === null && c.from !== null && c.from > today)
    .map((c) => ({ assignmentId: c.assignmentId, from: c.from! }));
}

/** The ISO day after `day`. */
export function dayAfter(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * Planted year as typed: 4 digits in พ.ศ., or ค.ศ. (below 2400) converted;
 * a year after this one is refused. Blank = unknown.
 */
export function parsePlantedYear(text: string, nowTs: number): { ok: true; yearBe: number | null } | { ok: false } {
  const t = text.trim();
  if (!t) return { ok: true, yearBe: null };
  if (!/^\d{4}$/.test(t)) return { ok: false };
  const n = Number(t);
  const yearBe = n < 2400 ? n + 543 : n;
  const thisYearBe = new Date(nowTs + BANGKOK_OFFSET_MS).getUTCFullYear() + 543;
  return yearBe <= thisYearBe ? { ok: true, yearBe } : { ok: false };
}
