/**
 * The close-out pages' one way in (E05-S11): the draft the owner is
 * changing (held in memory per sale, across the summary → cash step → back
 * pages, never written), the plan core computes from it, and the one
 * "ยืนยันยอด" write. Every screen of the flow reads this hook so they agree.
 *
 * The draft is not an event (CO-3: nothing is saved until confirm). If the
 * app is closed before confirm the draft is gone and the proposal shows
 * again; a confirm stopped part-way leaves the workers already written, and
 * re-running writes only what is missing (confirmWrites is idempotent).
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import {
  closeoutPlan,
  confirmGate,
  confirmWrites,
  debtPieces,
  type CloseoutWorkerDraft,
  type CloseoutWorkerInput,
  type RecordedLine,
  type RepayRoute,
} from '../../../core/finance/closeout';
import { projectDebts } from '../../../core/finance/debts';
import type { RoundingMode } from '../../../core/finance/deduct';
import { FARM_FUNDS } from '../../../core/finance/types';
import { newId } from '../../../lib/id';
import { saleDay } from '../../../core/sale-list';
import { statusCountsAsClosed } from '../../../core/sale-status';
import { useFinance } from '../../../finance/use-finance';
import { useInFlight } from '../../../finance/use-in-flight';
import { useSaleCounts } from '../../../finance/use-live-sales';
import { lastRepay, lastRounding, localPreferenceStore, rememberCloseout, type PreferenceStore } from '../../../store/closeout-preference';
import { sessionGroupId } from '../../../store/session';
import { useSaleMoney } from '../../money/sale/use-sale-money';

// ── the draft, in memory, per sale ──────────────────────────────────────────

export type OwedChoice = 'hold' | 'net';

export interface CloseoutDraft {
  readonly workers: Readonly<Record<string, CloseoutWorkerDraft>>;
  /** null = recorded rounding for this sale, else this device's last choice (CO-23). */
  readonly rounding: RoundingMode | null;
  /** CO-17: workers whose debt the owner confirmed ("ถูกต้อง", or ✓ on the deduct sheet A22). */
  readonly debtChecked: readonly string[];
  /** CO-17 asking card answered "ไม่มี". */
  readonly debtAnswered: boolean;
  /** CO-26: workers the farm owes, checked; and the asking card answered. */
  readonly owedChecked: readonly string[];
  readonly owedAnswered: boolean;
  readonly owedChoice: Readonly<Record<string, OwedChoice>>;
  /**
   * Review #10: what each worker's figures were when this draft last saw them
   * (balance, this sale's recorded lines, what the farm owes). When they move
   * under the draft — another device synced, or "จดหนี้เพิ่ม" — that worker's
   * checks are dropped so the cards ask again.
   */
  readonly seen: Readonly<Record<string, string>>;
}

const EMPTY_DRAFT: CloseoutDraft = { workers: {}, rounding: null, debtChecked: [], debtAnswered: false, owedChecked: [], owedAnswered: false, owedChoice: {}, seen: {} };

const drafts = new Map<string, CloseoutDraft>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function updateDraft(saleId: string, change: (d: CloseoutDraft) => CloseoutDraft): void {
  drafts.set(saleId, change(drafts.get(saleId) ?? EMPTY_DRAFT));
  notify();
}

export function clearDraft(saleId: string): void {
  drafts.delete(saleId);
  notify();
}

export function useCloseoutDraft(saleId: string): CloseoutDraft {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => drafts.get(saleId) ?? EMPTY_DRAFT,
    () => EMPTY_DRAFT,
  );
}

// ── the hook ────────────────────────────────────────────────────────────────

const groupOr = () => {
  try {
    return sessionGroupId();
  } catch {
    return 'local';
  }
};

export function useCloseout(store: PreferenceStore = localPreferenceStore) {
  const money = useSaleMoney();
  const fin = useFinance();
  const flight = useInFlight();
  /** The last "ยืนยันยอด" stopped (a write threw, or a worker's lines could not be placed): said on screen, never silent. */
  const [failed, setFailed] = useState(false);
  const saleId = money.state.id;
  const draft = useCloseoutDraft(saleId);
  const groupId = groupOr();
  const counts = useSaleCounts();
  // This hook's own reader is the one `fin.write` reloads: built from it, a confirm stopped
  // part-way and pressed again sees the lines it already wrote (useSaleMoney's reader does not reload).
  const debts = useMemo(() => projectDebts(fin.events ?? [], counts), [fin.events, counts]);
  /** A completed sale is read-only (review #2): nothing here writes for it. */
  const closed = money.loaded && statusCountsAsClosed(money.state);

  const ready = money.loaded && !!money.settlement && fin.events !== null && fin.state !== null;

  const derived = useMemo(() => {
    if (!ready || !money.settlement || !fin.state) return null;
    const s = money.settlement;
    const lines = (id: string) => (debts.get(id)?.payments ?? []).filter((p) => p.saleId === saleId && !p.deleted && p.counts);
    const repaymentOf = (id?: string) => (id ? fin.state!.repayments.find((r) => r.id === id && !r.deleted) : undefined);
    const owedOf = (id: string) => {
      const netted = lines(id).filter((p) => p.method === 'netting').map((p) => repaymentOf(p.repaymentId)).filter((r) => !!r);
      return fin.state!.reimbursements
        .filter((r) => r.to.id === id)
        .map((r) => ({ ...r, remainingSatang: r.remainingSatang + netted.reduce((a, rep) => a + rep.allocations.filter((x) => x.expenseId === r.expenseId).reduce((y, x) => y + x.satang, 0), 0) }));
    };
    const inputs: CloseoutWorkerInput[] = money.tappers.map((tp) => {
      const account = debts.get(tp.id);
      const here = lines(tp.id);
      const total = here.reduce((a, p) => a + p.amountSatang, 0);
      const net = here.filter((p) => p.method === 'netting').reduce((a, p) => a + p.amountSatang, 0);
      const route = (here.find((p) => p.method !== 'netting' && p.method !== 'outside')?.method ?? null) as RepayRoute | null;
      return {
        id: tp.id,
        name: tp.name,
        shareSatang: Math.max(0, tp.shareSatang),
        balanceSatang: Math.max(0, (account?.balanceSatang ?? 0) + total),
        planPerSaleSatang: account?.planPerSaleSatang ?? null,
        owedBackSatang: owedOf(tp.id).reduce((a, r) => a + Math.max(0, r.remainingSatang), 0),
        recorded: here.length ? { totalSatang: total, nettingSatang: net, route } : null,
      };
    });
    const rounding = draft.rounding ?? (money.rounding.choice.asked ? money.rounding.choice.mode : lastRounding(store, groupId));
    const plan = closeoutPlan({
      saleTotalSatang: s.grossSatang,
      ownerShareSatang: s.ownerSatang,
      workers: inputs,
      drafts: draft.workers,
      defaultRoute: (id) => lastRepay(store, groupId, id),
      rounding,
    });
    const pieces = new Map(money.tappers.flatMap((tp) => { const account = debts.get(tp.id); return account ? [[tp.id, debtPieces(account, saleId, plan.workers.find((w) => w.id === tp.id)?.totalSatang ?? 0)] as const] : []; }));
    const debtors = inputs.filter((w) => w.balanceSatang > 0).map((w) => ({ id: w.id, name: w.name }));
    const owed = inputs.filter((w) => w.owedBackSatang > 0).map((w) => ({ id: w.id, name: w.name, satang: w.owedBackSatang }));
    const gate = confirmGate({
      debtors,
      debtChecked: new Set(draft.debtChecked),
      debtAnswered: draft.debtAnswered,
      owed,
      owedChecked: new Set(draft.owedChecked),
      owedAnswered: draft.owedAnswered,
      plan,
    });
    const recordedLines = (id: string): RecordedLine[] =>
      lines(id).map((p) => ({ id: p.id, headEventId: p.headEventId, method: p.method, amountSatang: p.amountSatang, repaymentId: p.repaymentId, repaymentHead: repaymentOf(p.repaymentId)?.headEventId }));
    // An older sale may hold one tapper's deduction on two routes; saving puts it on the one chosen (review #9).
    const mixed = new Set(money.tappers.filter((tp) => new Set(lines(tp.id).filter((p) => p.method !== 'netting' && p.method !== 'outside').map((p) => p.method)).size > 1).map((tp) => tp.id));
    return { settlement: s, inputs, plan, pieces, debtors, owed, gate, recordedLines, owedOf, mixed };
  }, [ready, money, fin.state, debts, saleId, draft, store, groupId]);

  // Review #10: each check remembers the figures it was made on; when they move, the card asks again.
  const sigs = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of derived?.inputs ?? []) {
      const rec = w.recorded ? `${w.recorded.totalSatang}/${w.recorded.nettingSatang}/${w.recorded.route}` : '-';
      m.set(`debt:${w.id}`, `${w.balanceSatang}|${rec}`);
      m.set(`owed:${w.id}`, `${w.owedBackSatang}|${rec}`);
    }
    return m;
  }, [derived]);
  const moved = (kind: 'debt' | 'owed', ids: readonly string[], seen: Readonly<Record<string, string>>) =>
    ids.filter((id) => seen[`${kind}:${id}`] !== undefined && sigs.has(`${kind}:${id}`) && seen[`${kind}:${id}`] !== sigs.get(`${kind}:${id}`));
  const staleDebt = moved('debt', draft.debtChecked, draft.seen ?? {});
  const staleOwed = moved('owed', draft.owedChecked, draft.seen ?? {});
  const stale = [...staleDebt.map((id) => `debt:${id}`), ...staleOwed.map((id) => `owed:${id}`)].join(',');
  useEffect(() => {
    if (!stale) return;
    const gone = new Set(stale.split(','));
    updateDraft(saleId, (d) => ({
      ...d,
      debtChecked: d.debtChecked.filter((id) => !gone.has(`debt:${id}`)),
      owedChecked: d.owedChecked.filter((id) => !gone.has(`owed:${id}`)),
      seen: Object.fromEntries(Object.entries(d.seen ?? {}).filter(([k]) => !gone.has(k))),
    }));
  }, [stale, saleId]);
  /** Every draft change; a check just made remembers the figures it was made on. */
  const update = (f: (d: CloseoutDraft) => CloseoutDraft) =>
    updateDraft(saleId, (d) => {
      const n = f(d);
      const seen = { ...(n.seen ?? {}) };
      for (const id of n.debtChecked) if (!d.debtChecked.includes(id) && sigs.has(`debt:${id}`)) seen[`debt:${id}`] = sigs.get(`debt:${id}`)!;
      for (const id of n.owedChecked) if (!d.owedChecked.includes(id) && sigs.has(`owed:${id}`)) seen[`owed:${id}`] = sigs.get(`owed:${id}`)!;
      return { ...n, seen };
    });

  /** "ยืนยันยอด": write each worker's lines (existing event types), then rounding, then remember the choices. */
  const confirm = async (): Promise<boolean> => {
    let done = false;
    await flight.run(async () => {
      if (!derived || derived.gate.kind !== 'ready' || closed) return;
      setFailed(false);
      try {
        done = await writeAll(derived);
      } catch {
        done = false;
      }
      if (!done) {
        // What did land stays (confirmWrites is idempotent); read the log again so the next press writes only the rest.
        // Those lines are this device's own: the figures move, but the owner's checks stand (what they were made on is forgotten).
        updateDraft(saleId, (d) => ({ ...d, seen: {} }));
        setFailed(true);
        fin.reload();
      }
    });
    return done;
  };
  /** Every worker's writes, then the rounding and the remembered choices; false when a worker's lines cannot be placed. */
  const writeAll = async (d: NonNullable<typeof derived>): Promise<boolean> => {
    const farm = { id: FARM_FUNDS, name: '' };
    for (const w of d.plan.workers) {
      const res = confirmWrites({
        saleId,
        date: saleDay(money.state.startedTs, Date.now()),
        worker: { id: w.id, name: w.name },
        farm,
        plan: w,
        recorded: d.recordedLines(w.id),
        owed: d.owedOf(w.id),
        newId,
      });
      if (!res.ok) return false;
      for (const x of res.writes) {
        if (x.op === 'write') await fin.write(x.id, null, x.payload);
        else if (x.op === 'void-repayment') await fin.write(x.id, x.base, { t: 'repayment_changed', patch: { deleted: true } });
        else await fin.write(x.id, x.base, { t: 'debt_payment_changed', patch: { deleted: true } });
      }
    }
    const r = d.plan.rounding;
    if (d.plan.hasFraction && (!money.rounding.choice.asked || money.rounding.choice.mode !== r)) {
      await fin.write(`sale-rounding-${saleId}`, money.rounding.choice.head, { t: 'sale_rounding_set', saleId, mode: r });
    }
    rememberCloseout(
      store,
      groupId,
      d.plan.workers.filter((w) => w.routeSatang > 0).map((w) => ({ workerId: w.id, route: w.route })),
      d.plan.hasFraction ? r : null,
    );
    clearDraft(saleId);
    fin.reload();
    return true;
  };

  return { ready: !!derived, closed, money, fin, saleId, draft, update, confirm, failed, busy: flight.busy, ...(derived ?? {}) } as const;
}

export type Closeout = ReturnType<typeof useCloseout>;
