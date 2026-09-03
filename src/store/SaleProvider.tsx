/**
 * The one write path in the app: append an event, persist it, re-project.
 *
 * `appendMany` is the primitive and `append` is a batch of one (S23): a bulk
 * entry writes a gate-skip, N baskets, a leftover and a close, and that
 * sequence only means anything whole — so the batch is stamped once and
 * handed to the store as one indivisible write.
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
import type { SaleEvent, SaleState, SysPayload } from '../core/types';
// Bare specifier, not './store.web' — Metro resolves this to store.native.ts
// on iOS/Android and store.web.ts on web. A literal '.web' import here would
// silently pull the localStorage adapter into native builds too, which is
// exactly the least-durable path NFR-1 exists to avoid.
import { store } from './store';

/** Every event minus the fields the provider stamps. */
type NewEvent =
  | {
      kind: 'accept';
      pileId: string;
      source: 'hold' | 'hold-kbd' | 'bulk';
      netG: number;
      tareG: number;
    }
  | { kind: 'short'; pileId: string; readingG: number; tareG: number }
  | {
      kind: 'reject';
      pileId: string;
      source: 'hold' | 'hold-kbd';
      reason: 'released-early';
      heldMs: number;
    }
  | { kind: 'correction'; pileId: string; targetSeq: number; mode: 'undo-last' | 'void'; reason: string }
  | { kind: 'sys'; payload: SysPayload };

interface SaleContextValue {
  saleId: string;
  events: readonly SaleEvent[];
  state: SaleState;
  ready: boolean;
  append: (e: NewEvent) => void;
  /**
   * Appends a batch as one indivisible write (S23's bulk entry). See
   * `EventStore.appendAll` for why the storage tier has to be in on it: a
   * sequence that only means anything whole cannot be persisted in pieces.
   */
  appendMany: (events: readonly NewEvent[]) => void;
  reset: () => void;
}

const SaleContext = createContext<SaleContextValue | null>(null);

export function SaleProvider({ saleId, children }: { saleId: string; children: ReactNode }) {
  const [events, setEvents] = useState<readonly SaleEvent[]>([]);
  const [ready, setReady] = useState(false);
  const actor = useRef('somchai');

  useEffect(() => {
    let live = true;
    (async () => {
      // No seeding: a sale with no events is a real, legitimate state (one
      // that hasn't been set up yet), not a placeholder waiting to be filled
      // by demo data. See docs/stories/s17-remove-seed-and-sale-list.md.
      const loaded = await store.load(saleId);
      if (live) {
        setEvents(loaded);
        setReady(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [saleId]);

  const appendMany = useCallback((incoming: readonly NewEvent[]) => {
    if (!incoming.length) return;
    setEvents((prev) => {
      const last = prev.length ? prev[prev.length - 1] : null;
      const ts = Date.now();
      // Monotonic, for interval evidence (FR-12.4). Survives a wall clock that
      // jumps; deliberately a different field from `ts`, which is untrusted.
      const mono = Math.round(
        typeof performance !== 'undefined' ? performance.now() : Date.now(),
      );

      const batch: SaleEvent[] = [];
      let seq = (last?.seq ?? 0) + 1;

      // FR-12.6: a suspect clock is recorded as its own event and flagged in
      // the UI. It never reorders anything — `seq` decides what happened first.
      // One check per batch: every event in a batch shares one `ts`, so a
      // second check could only ever repeat the first.
      const startedTs = projectSale(prev, saleId).startedTs;
      const anomaly = detectClockAnomaly(last, ts, startedTs);
      if (anomaly) {
        batch.push({
          saleId,
          seq: seq++,
          ts,
          mono,
          actor: actor.current,
          kind: 'sys',
          payload: { t: 'clock_anomaly', ...anomaly },
        });
      }

      for (const e of incoming) {
        batch.push({ saleId, seq: seq++, ts, mono, actor: actor.current, ...e } as SaleEvent);
      }

      // Fire-and-forget: a storage failure must never block counting. The
      // store swallows quota errors for the same reason. What it must NOT do
      // is store part of a batch — see `EventStore.appendAll`.
      void store.appendAll(batch);
      return [...prev, ...batch];
    });
  }, [saleId]);

  // One event is a batch of one. Keeping a single implementation is the point
  // of this file: one way to write, and no second stamping path to drift.
  const append = useCallback((incoming: NewEvent) => appendMany([incoming]), [appendMany]);

  const reset = useCallback(() => setEvents([]), []);

  // The whole reason `append` must produce a NEW array rather than mutating:
  // this memo is keyed on array identity.
  const state = useMemo(() => projectSale(events, saleId), [events, saleId]);

  const value = useMemo<SaleContextValue>(
    () => ({ saleId, events, state, ready, append, appendMany, reset }),
    [saleId, events, state, ready, append, appendMany, reset],
  );

  return <SaleContext.Provider value={value}>{children}</SaleContext.Provider>;
}

export function useSale(): SaleContextValue {
  const ctx = useContext(SaleContext);
  if (!ctx) throw new Error('useSale must be used inside <SaleProvider>');
  return ctx;
}
