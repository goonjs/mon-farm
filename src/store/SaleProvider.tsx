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
import type { SaleEvent, SaleState, SysPayload } from '../core/types';
import { store } from './store.web';

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
  | { kind: 'correction'; pileId: string; targetSeq: number; mode: 'undo-last' | 'void'; reason: string }
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

export function SaleProvider({
  saleId,
  children,
  seed,
}: {
  saleId: string;
  children: ReactNode;
  /** Events written once if the store has none — the demo sale. */
  seed?: readonly SaleEvent[];
}) {
  const [events, setEvents] = useState<readonly SaleEvent[]>([]);
  const [ready, setReady] = useState(false);
  const actor = useRef('somchai');

  useEffect(() => {
    let live = true;
    (async () => {
      let loaded = await store.load(saleId);
      if (loaded.length === 0 && seed?.length) {
        for (const e of seed) await store.append(e);
        loaded = await store.load(saleId);
      }
      if (live) {
        setEvents(loaded);
        setReady(true);
      }
    })();
    return () => {
      live = false;
    };
    // `seed` is a fixture and intentionally not a dependency: re-seeding on
    // every render would append the demo sale repeatedly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  const append = useCallback((incoming: NewEvent) => {
    setEvents((prev) => {
      const last = prev.length ? prev[prev.length - 1] : null;
      const seq = (last?.seq ?? 0) + 1;
      const ts = Date.now();
      // Monotonic, for interval evidence (FR-12.4). Survives a wall clock that
      // jumps; deliberately a different field from `ts`, which is untrusted.
      const mono = Math.round(
        typeof performance !== 'undefined' ? performance.now() : Date.now(),
      );

      const out: SaleEvent[] = [...prev];

      // FR-12.6: a suspect clock is recorded as its own event and flagged in
      // the UI. It never reorders anything — `seq` decides what happened first.
      const startedTs = projectSale(prev, saleId).startedTs;
      const anomaly = detectClockAnomaly(last, ts, startedTs);
      if (anomaly) {
        const flag: SaleEvent = {
          saleId,
          seq,
          ts,
          mono,
          actor: actor.current,
          kind: 'sys',
          payload: { t: 'clock_anomaly', ...anomaly },
        };
        out.push(flag);
        void store.append(flag);
      }

      const event = {
        saleId,
        seq: out.length ? out[out.length - 1].seq + 1 : seq,
        ts,
        mono,
        actor: actor.current,
        ...incoming,
      } as SaleEvent;

      out.push(event);
      // Fire-and-forget: a storage failure must never block counting. The
      // store swallows quota errors for the same reason.
      void store.append(event);
      return out;
    });
  }, [saleId]);

  const reset = useCallback(() => setEvents([]), []);

  // The whole reason `append` must produce a NEW array rather than mutating:
  // this memo is keyed on array identity.
  const state = useMemo(() => projectSale(events, saleId), [events, saleId]);

  const value = useMemo<SaleContextValue>(
    () => ({ saleId, events, state, ready, append, reset }),
    [saleId, events, state, ready, append, reset],
  );

  return <SaleContext.Provider value={value}>{children}</SaleContext.Provider>;
}

export function useSale(): SaleContextValue {
  const ctx = useContext(SaleContext);
  if (!ctx) throw new Error('useSale must be used inside <SaleProvider>');
  return ctx;
}
