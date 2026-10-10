/**
 * Soft Delete and provenance, derived from the log (E01-S04).
 *
 * Neither is stored anywhere else. Whether a record is deleted is the last
 * `delete`/`restore` naming it, in fold order (never by clock); who made or
 * changed a record is read off the events that touch it (SYNC-11).
 */

import { compareEvents } from './order';
import type { Actor, RecordId, SaleEvent, Source } from './types';

/** Records whose latest delete/restore is a delete. */
export function deletedIds(events: readonly SaleEvent[]): ReadonlySet<RecordId> {
  const out = new Set<RecordId>();
  // Filter first: this runs on every totals call, and delete/restore events
  // are a handful in a log of hundreds of baskets.
  const marks = events.filter((e) => e.kind === 'delete' || e.kind === 'restore').sort(compareEvents);
  for (const e of marks) {
    if (e.kind === 'delete') out.add(e.targetId);
    else out.delete(e.targetId);
  }
  return out;
}

export interface Stamp {
  readonly actor: Actor;
  readonly ts: number;
  readonly source: Source;
}

export interface Provenance {
  readonly created: Stamp;
  /** The latest later event touching the record; null if none. */
  readonly changed: Stamp | null;
}

/**
 * Who created a record and who last changed it, with when and through which
 * channel. The confirmation state (Estimated / User provided …) joins this
 * with per-field data states in E01-S15. `ts` is the device's wall clock —
 * shown to people, never used to decide anything.
 */
export function provenance(events: readonly SaleEvent[], id: RecordId): Provenance | null {
  const touching = [...events].filter((e) => touches(e, id)).sort(compareEvents);
  // A record exists from its creating event; a delete/restore naming an id
  // nothing ever created does not make it one.
  if (!touching.length || isMark(touching[0])) return null;
  const stamp = (e: SaleEvent): Stamp => ({ actor: e.actor, ts: e.ts, source: channel(e) });
  const last = touching[touching.length - 1];
  return { created: stamp(touching[0]), changed: touching.length > 1 ? stamp(last) : null };
}

function isMark(e: SaleEvent): boolean {
  return e.kind === 'delete' || e.kind === 'restore';
}

/**
 * Events written before E01-S04 (dev builds only) carry no envelope
 * `source`, and their baskets used `source` for the input method; both mean
 * "entered in this app".
 */
function channel(e: SaleEvent): Source {
  const s = (e as { source?: unknown }).source;
  return s === 'line' || s === 'import' || s === 'ai' ? s : 'app';
}

/**
 * Does this event create or change record `id`? Every event of a sale counts
 * as touching the sale, automatic ones (`announced`, `clock_anomaly`)
 * included: they are part of its record too.
 */
function touches(e: SaleEvent, id: RecordId): boolean {
  if (e.saleId === id || e.id === id) return true;
  switch (e.kind) {
    case 'delete':
    case 'restore':
    case 'correction':
      return e.targetId === id;
    case 'sys': {
      const p = e.payload as {
        zoneId?: string;
        pileId?: string;
        deductionId?: string;
        forcedPiles?: readonly string[];
      };
      return p.zoneId === id || p.pileId === id || p.deductionId === id || !!p.forcedPiles?.includes(id);
    }
    case 'master': {
      const p = e.payload as { personId?: string; buyerId?: string; propertyId?: string; pointId?: string };
      // A point names its farm too, but only creates/changes the point.
      if (p.pointId) return p.pointId === id;
      return p.personId === id || p.buyerId === id || p.propertyId === id;
    }
    default:
      return false;
  }
}
