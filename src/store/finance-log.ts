/**
 * The finance log on the one event log (E01-S28 round 2).
 *
 * Every finance event is an event in the same `EventStore` as sales and
 * master data, under `FINANCE_SCOPE` (stored in place of a sale id, like
 * `MASTER_SCOPE`), `kind: 'finance'`, with the old event's `targetId`,
 * `baseEventId` and `payload` unchanged (S28-AC1). So it is durable the way a
 * basket is, sits in the same outbox, and is sent and pulled by the same sync
 * engine (AC2, AC3) under the same scope rule (AC8). `EventFinanceStore` is the
 * thin `FinanceStore` port over it, the way `MasterStore` is for people, so
 * the money screens and projections do not change.
 *
 * Two more things happen here, both once:
 *
 * - The old device-only log (localStorage `mon-farm:finance-events` on web,
 *   the `finance_events` table on device) is copied in on first use (AC5):
 *   ids already in the store are skipped, so a copy cut short just runs again
 *   (AC6). A marker in the store's meta keeps how many old events were seen;
 *   an old log that grew since (a round-1 tab still open in the same browser,
 *   review N2) is copied again. The old log is kept as it is and never written
 *   by this build (AC7). A malformed old row is skipped and logged (review N7).
 * - Before the first finance event of a group can be sent, the group gets one
 *   `kind: 'app_min'` event with `minApp: APP_RELEASE` (story schema section).
 *   It is appended first, so it has the lower `deviceSeq` and the outbox,
 *   which drains in `deviceSeq` order, sends it first. A build below it shows
 *   "อัปเดตแอปก่อนใช้หน้าเงิน" instead of totals it cannot count (AC12 ก).
 *
 * Unsuffixed and platform-free: the platform files bind it to the platform
 * store and the old log (`finance.web.ts`, `finance.native.ts`).
 */

import { canonicalJson } from '../core/canonical';
import { APP_MIN_KIND, APP_RELEASE, FINANCE_SCOPE, minAppOf } from '../core/finance-scope';
import type { FinanceEvent } from '../core/finance/types';
import { belongsTo, hasGroup, type Scope } from '../core/scope';
import type { AppMinEvent, FinanceLogEvent, SaleEvent } from '../core/types';
import { uuidv7 } from '../lib/id';
import type { DeviceClock } from './device-clock';
import { IntegrityError } from './errors';
import type { FinanceStore } from './finance';
import type { EventStore } from './store';

/** The store-meta key of the copy marker (S28-AC6): `{"count": <old events seen>}`. */
export const FINANCE_MIGRATED_FLAG = 'financeLogCopied';

/** What is left of the old finance log: read once, never written (S28-AC7). */
export interface LegacyFinanceLog {
  load(): Promise<FinanceEvent[]>;
}

const isFinance = (e: SaleEvent): e is FinanceLogEvent => e.kind === 'finance';

/**
 * The finance event the screens and projections know, without the envelope-only fields. A round-1 tab's
 * `fromEnvelope` stored a pulled create without `baseEventId: null` and without a `targetId` equal to its own
 * id (review B1): read back, that is a create of its own record, never an edit of nothing.
 */
export function toFinanceEvent(e: FinanceLogEvent): FinanceEvent {
  const { id, groupId, deviceSeq, ts, actor, source, targetId, baseEventId, payload } = e;
  return { id, groupId, deviceSeq, ts, actor, source, targetId: targetId ?? id, baseEventId: baseEventId ?? null, payload };
}

/** An old-log row the copy can trust; anything else is skipped and logged, never copied (review N7). */
function wellFormed(e: unknown): e is FinanceEvent {
  const x = e as Record<string, unknown> | null;
  if (!x || typeof x !== 'object') return false;
  const actor = x.actor as Record<string, unknown> | null | undefined;
  const payload = x.payload as Record<string, unknown> | null | undefined;
  return (
    typeof x.id === 'string' &&
    x.id !== '' &&
    typeof x.targetId === 'string' &&
    typeof x.ts === 'number' &&
    typeof x.deviceSeq === 'number' &&
    !!actor &&
    typeof actor.userId === 'string' &&
    typeof actor.deviceId === 'string' &&
    !!payload &&
    typeof payload.t === 'string'
  );
}

const nextSeq = (log: readonly SaleEvent[]) => log.reduce((max, e) => Math.max(max, e.seq), 0) + 1;
const monoNow = () => Math.round(typeof performance !== 'undefined' ? performance.now() : Date.now());

function toStored(e: FinanceEvent, seq: number, mono: number): FinanceLogEvent {
  return {
    id: e.id,
    groupId: e.groupId,
    saleId: FINANCE_SCOPE,
    seq,
    deviceSeq: e.deviceSeq,
    ts: e.ts,
    mono,
    actor: e.actor,
    source: e.source,
    kind: 'finance',
    targetId: e.targetId,
    baseEventId: e.baseEventId,
    payload: e.payload,
  };
}

/** Same content apart from `deviceSeq`, which the store numbers for this device. */
const sameFinance = (a: FinanceEvent, b: FinanceEvent) => canonicalJson({ ...a, deviceSeq: 0 }) === canonicalJson({ ...b, deviceSeq: 0 });

/**
 * Writes the group minimum for `scope` unless the group already has one at this release or higher
 * (from this phone or pulled from another). True when it wrote one.
 */
export async function ensureAppMin(events: EventStore, clock: DeviceClock, scope: Scope, read?: readonly SaleEvent[]): Promise<boolean> {
  const log = read ?? (await events.load(FINANCE_SCOPE));
  if ((minAppOf(log.filter((e) => e.groupId === scope.groupId)) ?? 0) >= APP_RELEASE) return false;
  const deviceId = await clock.load();
  const event: AppMinEvent = {
    id: uuidv7(),
    groupId: scope.groupId,
    saleId: FINANCE_SCOPE,
    seq: nextSeq(log),
    deviceSeq: clock.take(),
    ts: Date.now(),
    mono: monoNow(),
    actor: { userId: scope.userId, deviceId },
    source: 'app',
    kind: APP_MIN_KIND,
    payload: { minApp: APP_RELEASE },
  };
  await events.append(event);
  return true;
}

/**
 * At sync start: money of this user in this group with no minimum yet (copied while nobody was signed in)
 * gets its minimum before the engine sends anything. Nothing to do without money.
 */
export async function ensureAppMinIfMoney(events: EventStore, clock: DeviceClock, scope: Scope): Promise<boolean> {
  const log = await events.load(FINANCE_SCOPE);
  if (!log.some((e) => isFinance(e) && belongsTo(scope, e))) return false;
  return ensureAppMin(events, clock, scope);
}

export interface MigrationResult {
  readonly copied: number;
  /** Already in the store (an earlier run, or another tab). */
  readonly skipped: number;
  /** Not copied and left in the old log: malformed, no group (before D-24), or an id the store holds with other content. */
  readonly refused: number;
}

interface CopyMarker {
  readonly count: number;
}

function readMarker(raw: string | null): CopyMarker | null {
  if (raw === null) return null;
  try {
    const m = JSON.parse(raw) as Partial<CopyMarker>;
    return typeof m.count === 'number' ? { count: m.count } : null;
  } catch {
    return null;
  }
}

/**
 * Copies the old finance log into the store once (S28-AC5/AC6) and sets the marker. Ids already in the store
 * are skipped without comparing content. Copies get `seq` 1 and `mono` 0, so two tabs copying at once write
 * identical events (the second is a no-op). With `clock`, this device's own events get fresh device numbers
 * up front; the store would renumber them anyway.
 */
export async function migrateFinanceLog(events: EventStore, legacy: LegacyFinanceLog, clock?: DeviceClock, old?: readonly FinanceEvent[]): Promise<MigrationResult> {
  const have = new Set((await events.load(FINANCE_SCOPE)).map((e) => e.id));
  const deviceId = clock ? await clock.load() : null;
  let copied = 0;
  let skipped = 0;
  let refused = 0;
  const rows = old ?? (await legacy.load());
  for (const e of rows) {
    if (!wellFormed(e)) {
      console.warn('An old finance row is malformed; left in the old log, not copied.', e);
      refused += 1;
      continue;
    }
    if (have.has(e.id)) {
      skipped += 1;
      continue;
    }
    // D-24: the store keeps nothing outside a group. Such an event stays in the old log, unsent and uncounted.
    if (!hasGroup(e)) {
      refused += 1;
      continue;
    }
    const deviceSeq = clock && e.actor.deviceId === deviceId ? clock.take() : e.deviceSeq;
    try {
      await events.append(toStored({ ...e, deviceSeq }, 1, 0));
    } catch (err) {
      if (!(err instanceof IntegrityError)) throw err;
      console.warn(`Old finance event ${e.id} not copied: the store holds that id with other content.`, err);
      refused += 1;
      continue;
    }
    have.add(e.id);
    copied += 1;
  }
  await events.setMetaValue(FINANCE_MIGRATED_FLAG, JSON.stringify({ count: rows.length } satisfies CopyMarker));
  return { copied, skipped, refused };
}

export class EventFinanceStore implements FinanceStore {
  /** The copy check in flight, shared by every caller that arrives meanwhile. */
  private checking: Promise<void> | null = null;
  /** One write at a time: `seq` and "is there a minimum yet" are read, then written. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly events: EventStore,
    private readonly clock: DeviceClock,
    private readonly legacy: LegacyFinanceLog,
    /** The signed-in user in the open group, or null: whom the minimum is written for during the copy. */
    private readonly scope: () => Scope | null,
  ) {}

  /**
   * The copy, on every use: cheap once done (the marker and the old log's length are compared), and run
   * again when the old log has grown since (review N2). A failure is retried on the next use.
   */
  private migrated(): Promise<void> {
    this.checking ??= (async () => {
      const old = await this.legacy.load();
      const marker = readMarker(await this.events.metaValue(FINANCE_MIGRATED_FLAG));
      if (marker && marker.count >= old.length) return;
      const scope = this.scope();
      // The minimum goes in before the copied money, so it has the lower device number.
      if (scope && old.some((e) => wellFormed(e) && belongsTo(scope, e))) await ensureAppMin(this.events, this.clock, scope);
      const result = await migrateFinanceLog(this.events, this.legacy, this.clock, old);
      if (result.copied || result.refused) console.info('Old finance log copied into the event log.', result);
    })().finally(() => {
      this.checking = null;
    });
    return this.checking;
  }

  /** The open group's money only (review N6); with nobody signed in, everything on the device. */
  private mineOnly(events: readonly SaleEvent[]): FinanceEvent[] {
    const scope = this.scope();
    return events.filter(isFinance).filter((e) => !scope || e.groupId === scope.groupId).map(toFinanceEvent);
  }

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /**
   * Same rule as before: a new id is stored, the same id with the same content is a no-op, the same id with
   * other content is refused (`IntegrityError`). This device's `deviceSeq` is the store's to number.
   */
  append(event: FinanceEvent): Promise<void> {
    return this.serial(async () => {
      await this.migrated();
      // One read of the scope per save (review N11): the minimum check and the next seq use it too.
      const log = await this.events.load(FINANCE_SCOPE);
      const existing = log.find((e) => e.id === event.id);
      if (existing) {
        if (isFinance(existing) && sameFinance(toFinanceEvent(existing), event)) return;
        throw new IntegrityError(`Finance event ${event.id} already stored with different content.`);
      }
      const wrote = await ensureAppMin(this.events, this.clock, { userId: event.actor.userId, groupId: event.groupId }, log);
      const deviceId = await this.clock.load();
      const deviceSeq = event.actor.deviceId === deviceId ? this.clock.take() : event.deviceSeq;
      await this.events.append(toStored({ ...event, deviceSeq }, nextSeq(log) + (wrote ? 1 : 0), monoNow()));
    });
  }

  /** Every finance event on this device (the group minimum is not one). The projections order them. */
  async load(): Promise<FinanceEvent[]> {
    try {
      await this.migrated();
    } catch (err) {
      // Money must not look gone: show the old log's events beside what the store has, and copy next time.
      console.error('The old finance log could not be copied yet; showing it as well.', err);
      const stored = this.mineOnly(await this.events.load(FINANCE_SCOPE));
      const ids = new Set(stored.map((e) => e.id));
      const scope = this.scope();
      const old = (await this.legacy.load().catch(() => [])).filter((e) => wellFormed(e) && (!scope || e.groupId === scope.groupId));
      return [...stored, ...old.filter((e) => !ids.has(e.id))];
    }
    return this.mineOnly(await this.events.load(FINANCE_SCOPE));
  }
}
