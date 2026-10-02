/**
 * The one write path in the app: append an event, persist it, re-project.
 *
 * No Redux, no Zustand, no Jotai. There is exactly one way to write (append)
 * and one way to read (fold the log). That *is* a reducer — adding a library
 * would give the same reducer with more ceremony, which YAGNI forbids.
 *
 * Performance, honestly: this re-folds the whole log on every basket, which is
 * O(n) per append and about 80k operations across a 400-basket sale. That is
 * nothing. Do NOT build an incremental projection. If a real device ever shows
 * lag, memoise per-pile totals by pile id — but measure first.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { detectClockAnomaly, projectSale } from '../core/project';
import type { Actor, SaleEvent, SaleState, SysPayload } from '../core/types';
import { uuidv7 } from '../lib/id';
import { createDeviceClock } from './device-clock';
import { PRE_LOGIN_USER_ID } from './session';
// Bare specifier, not './store.web' — Metro resolves this to store.native.ts
// on iOS/Android and store.web.ts on web. A literal '.web' import here would
// silently pull the localStorage adapter into native builds too, which is
// exactly the least-durable path NFR-1 exists to avoid.
import { store } from './store';

/** Shared by every provider — see device-clock.ts for why it cannot be per sale. */
const deviceClock = createDeviceClock(store);

/** Every event minus the fields the provider stamps. */
type NewEvent =
  | { kind: 'accept'; pileId: string; source: 'hold' | 'hold-kbd'; netG: number; tareG: number }
  | { kind: 'short'; pileId: string; readingG: number; tareG: number }
  | {
      kind: 'reject';
      pileId: string;
      source: 'hold' | 'hold-kbd';
      reason: 'released-early';
      heldMs: number;
    }
  | { kind: 'correction'; pileId: string; targetId: string; mode: 'undo-last' | 'void'; reason: string }
  | { kind: 'sys'; payload: SysPayload };

interface SaleContextValue {
  saleId: string;
  events: readonly SaleEvent[];
  state: SaleState;
  ready: boolean;
  append: (e: NewEvent) => void;
  reset: () => void;
}

const SaleContext = createContext<SaleContextValue | null>(null);

export function SaleProvider({ saleId, children }: { saleId: string; children: ReactNode }) {
  const [events, setEvents] = useState<readonly SaleEvent[]>([]);
  const [ready, setReady] = useState(false);
  // The log as last appended, kept beside the state so `append` can stamp the
  // next event without doing side effects inside a state updater (React may
  // run those twice, which would mint two ids for one basket).
  const eventsRef = useRef<readonly SaleEvent[]>([]);
  const actor = useRef<Actor | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      // No seeding: a sale with no events is a real, legitimate state (one
      // that hasn't been set up yet), not a placeholder waiting to be filled
      // by demo data. See docs/stories/s17-remove-seed-and-sale-list.md.
      const [loaded, deviceId] = await Promise.all([store.load(saleId), deviceClock.load()]);
      if (live) {
        actor.current = { userId: PRE_LOGIN_USER_ID, deviceId };
        eventsRef.current = loaded;
        setEvents(loaded);
        setReady(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [saleId]);

  const append = useCallback((incoming: NewEvent) => {
    const who = actor.current;
    // Screens only offer recording once `ready`; this is the backstop.
    if (!who) throw new Error('append() before the store is ready.');

    const prev = eventsRef.current;
    const last = prev.length ? prev[prev.length - 1] : null;
    const ts = Date.now();
    // Monotonic, for interval evidence (FR-12.4). Survives a wall clock that
    // jumps; deliberately a different field from `ts`, which is untrusted.
    const mono = Math.round(typeof performance !== 'undefined' ? performance.now() : Date.now());
    const stamp = (seq: number) => ({
      id: uuidv7(),
      saleId,
      seq,
      deviceSeq: deviceClock.take(),
      ts,
      mono,
      actor: who,
    });

    const out: SaleEvent[] = [...prev];

    // FR-12.6: a suspect clock is recorded as its own event and flagged in
    // the UI. It never reorders anything — the fold order never reads `ts`.
    const startedTs = projectSale(prev, saleId).startedTs;
    const anomaly = detectClockAnomaly(last, ts, startedTs);
    if (anomaly) {
      out.push({
        ...stamp(nextSeq(out)),
        kind: 'sys',
        payload: { t: 'clock_anomaly', ...anomaly },
      });
    }
    out.push({ ...stamp(nextSeq(out)), ...incoming } as SaleEvent);

    eventsRef.current = out;
    setEvents(out);
    // Fire-and-forget: a storage failure must never block counting. The
    // stores run appends in call order (see store.native.ts).
    for (const e of out.slice(prev.length)) void store.append(e).catch(logAppendFailure);
  }, [saleId]);

  const reset = useCallback(() => {
    eventsRef.current = [];
    setEvents([]);
  }, []);

  // The whole reason `append` must produce a NEW array rather than mutating:
  // this memo is keyed on array identity.
  const state = useMemo(() => projectSale(events, saleId), [events, saleId]);

  const value = useMemo<SaleContextValue>(
    () => ({ saleId, events, state, ready, append, reset }),
    [saleId, events, state, ready, append, reset],
  );

  return <SaleContext.Provider value={value}>{children}</SaleContext.Provider>;
}

/** The next per-sale position, as this device sees the log. */
function nextSeq(events: readonly SaleEvent[]): number {
  return events.reduce((max, e) => Math.max(max, e.seq), 0) + 1;
}

function logAppendFailure(err: unknown): void {
  console.error('Event could not be stored.', err);
}

export function useSale(): SaleContextValue {
  const ctx = useContext(SaleContext);
  if (!ctx) throw new Error('useSale must be used inside <SaleProvider>');
  return ctx;
}
