/**
 * Conflict detection for one record (E01-S11; architecture §ตรวจ Conflict).
 *
 * Every change names what it was based on (`baseEventId`, plus `alsoBasedOn`
 * when it saw several lines of history). That is the only cross-device order
 * there is: `ts` and arrival order never decide anything (NFR-3). A record
 * whose history has one head folds as a line. Several heads mean phones
 * edited without seeing each other, and D-30 decides per field:
 *
 *   - untouched by every line          → the base value
 *   - every line that touched it agrees → that value
 *   - two different values             → conflict, whatever the field
 *   - one value, but the field is strict (money, weight, count, status, or
 *     the deleted flag) and another line changed something else → conflict
 *
 * A conflicted field shows its base value (D-29) and blocks closing the sale
 * (`blockingConflicts`). Deleting while another phone edits conflicts on the
 * deleted flag and on everything the edit touched, so the record shows "not
 * deleted, value before the edit" until someone decides.
 *
 * Pure and deterministic: every phone computes the same result from the same
 * set of events, so no server is involved.
 */

import { canonicalJson } from './canonical';
import type { EventId, RecordId } from './types';

export interface ChangeNode {
  readonly id: EventId;
  readonly targetId: RecordId;
  /** null for the create. */
  readonly baseEventId: EventId | null;
  readonly alsoBasedOn?: readonly EventId[];
  /** Fields this event sets. `deleted: true|false` is delete / restore. */
  readonly patch: Readonly<Record<string, unknown>>;
}

export type Value = Readonly<Record<string, unknown>>;

export interface FieldConflict {
  readonly targetId: RecordId;
  readonly field: string;
  readonly base: unknown;
  readonly options: readonly { readonly eventId: EventId; readonly value: unknown }[];
}

export interface RecordState {
  readonly targetId: RecordId;
  readonly value: Value;
  readonly heads: readonly EventId[];
  readonly conflicts: readonly FieldConflict[];
  /** Some change arrived before its base; it is left out until the base comes. */
  readonly waiting: boolean;
}

/** Fields that never merge silently (D-30): money, weight, count, status, deletion. */
export const STRICT_FIELDS: ReadonlySet<string> = new Set([
  'deleted',
  'netG',
  'tareG',
  'grossG',
  'readingG',
  'pricePerKg',
  'sharePct',
  'amount',
  'count',
  'qty',
  'status',
  'paymentStatus',
]);

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

const parentsOf = (n: ChangeNode): EventId[] =>
  n.baseEventId === null ? [] : [n.baseEventId, ...(n.alsoBasedOn ?? [])];

export function foldRecord(
  events: readonly ChangeNode[],
  isStrict: (field: string) => boolean = (f) => STRICT_FIELDS.has(f),
): RecordState {
  const all = new Map(events.map((e) => [e.id, e]));

  // A change is usable once its whole ancestry has arrived.
  const usable = new Map<EventId, ChangeNode>();
  const ready = (id: EventId, seen = new Set<EventId>()): boolean => {
    if (usable.has(id)) return true;
    const n = all.get(id);
    if (!n || seen.has(id)) return false;
    seen.add(id);
    if (!parentsOf(n).every((p) => ready(p, seen))) return false;
    usable.set(id, n);
    return true;
  };
  for (const id of all.keys()) ready(id);
  const waiting = usable.size < all.size;

  const ancestry = new Map<EventId, ReadonlySet<EventId>>();
  const ancestorsOf = (id: EventId): ReadonlySet<EventId> => {
    let set = ancestry.get(id);
    if (!set) {
      const s = new Set<EventId>([id]);
      for (const p of parentsOf(usable.get(id)!)) for (const a of ancestorsOf(p)) s.add(a);
      ancestry.set(id, (set = s));
    }
    return set;
  };

  const headsOf = (set: ReadonlySet<EventId>): EventId[] => {
    const referenced = new Set<EventId>();
    for (const id of set) for (const p of parentsOf(usable.get(id)!)) referenced.add(p);
    return [...set].filter((id) => !referenced.has(id)).sort();
  };

  const targetId = events[0]?.targetId ?? '';
  const memo = new Map<string, { value: Value; conflicts: FieldConflict[] }>();

  // The value of a history (a set of events closed under "based on").
  const valueOf = (set: ReadonlySet<EventId>): { value: Value; conflicts: FieldConflict[] } => {
    const key = [...set].sort().join(',');
    const hit = memo.get(key);
    if (hit) return hit;
    let out: { value: Value; conflicts: FieldConflict[] };
    const heads = headsOf(set);
    if (heads.length === 0) {
      out = { value: {}, conflicts: [] };
    } else if (heads.length === 1) {
      const head = usable.get(heads[0])!;
      const rest = new Set(set);
      rest.delete(head.id);
      const before = valueOf(rest);
      // The head saw every line before it; the fields it sets are decided.
      out = {
        value: { ...before.value, ...head.patch },
        conflicts: before.conflicts.filter((c) => !(c.field in head.patch)),
      };
    } else {
      out = merge(heads);
    }
    memo.set(key, out);
    return out;
  };

  const merge = (heads: EventId[]) => {
    const lines = heads.map((h) => ({ head: h, set: ancestorsOf(h) }));
    const common = new Set([...lines[0].set].filter((id) => lines.every((l) => l.set.has(id))));
    const base = valueOf(common);
    const values = lines.map((l) => ({ head: l.head, ...valueOf(l.set) }));
    const fields = new Set<string>();
    for (const v of values) for (const f of Object.keys(v.value)) fields.add(f);
    for (const f of Object.keys(base.value)) fields.add(f);

    const changedBy = (f: string) => values.filter((v) => !same(v.value[f], base.value[f]));
    const touchedAnything = (v: (typeof values)[number]) => [...fields].some((f) => !same(v.value[f], base.value[f]));

    const value: Record<string, unknown> = { ...base.value };
    const conflicts: FieldConflict[] = [];
    const flag = (f: string, changed: typeof values) => {
      const options: { eventId: EventId; value: unknown }[] = [];
      for (const v of changed) if (!options.some((o) => same(o.value, v.value[f]))) options.push({ eventId: v.head, value: v.value[f] });
      conflicts.push({ targetId, field: f, base: base.value[f], options });
    };

    const decided = [...fields].sort().map((f) => {
      const changed = changedBy(f);
      const distinct = new Set(changed.map((v) => canonicalJson(v.value[f] ?? null)));
      const othersMoved = values.some((v) => !changed.includes(v) && touchedAnything(v));
      const conflict = distinct.size > 1 || (distinct.size === 1 && isStrict(f) && othersMoved);
      return { f, changed, conflict };
    });
    const deletionContested = decided.some((d) => d.f === 'deleted' && d.conflict);

    for (const { f, changed, conflict } of decided) {
      // Inherited conflicts from inside one line stay open.
      if (conflict || (deletionContested && changed.length > 0)) {
        flag(f, changed);
      } else if (changed.length > 0) {
        value[f] = changed[0].value[f];
      }
    }
    // Conflicts still open inside a line stay open, with every line's options.
    for (const v of values) {
      for (const c of v.conflicts) {
        const i = conflicts.findIndex((x) => x.field === c.field);
        if (i < 0) {
          conflicts.push(c);
          continue;
        }
        const options = [...conflicts[i].options];
        for (const o of c.options) if (!options.some((x) => same(x.value, o.value))) options.push(o);
        conflicts[i] = { ...conflicts[i], options };
      }
    }
    for (const c of conflicts) {
      if (c.base === undefined) delete value[c.field];
      else value[c.field] = c.base;
    }
    return { value, conflicts };
  };

  const everything = new Set(usable.keys());
  const { value, conflicts } = valueOf(everything);
  return { targetId, value, heads: headsOf(everything), conflicts, waiting };
}

/**
 * The change that settles a record: based on every head, setting the chosen
 * value of each conflicted field (a value from one phone, or the base).
 */
export function resolution(
  state: RecordState,
  chosen: Readonly<Record<string, unknown>>,
): Omit<ChangeNode, 'id'> {
  const [first, ...rest] = state.heads;
  return { targetId: state.targetId, baseEventId: first, alsoBasedOn: rest, patch: { ...chosen } };
}

/** Every open conflict among a sale's records; any one blocks closing or paying (E01-S11 AC5). */
export function blockingConflicts(records: readonly RecordState[]): FieldConflict[] {
  return records.flatMap((r) => r.conflicts);
}
