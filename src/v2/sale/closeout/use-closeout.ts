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

import { useMemo, useSyncExternalStore } from 'react';

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
import { overDeducted, type RoundingMode } from '../../../core/finance/deduct';
import { FARM_FUNDS } from '../../../core/finance/types';
import { saleDay } from '../../../core/sale-list';
import { useFinance } from '../../../finance/use-finance';
import { useInFlight } from '../../../finance/use-in-flight';
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
  /** CO-19: the cash step was visited and ตกลง pressed. */
  readonly cashStepDone: boolean;
}

const EMPTY_DRAFT: CloseoutDraft = { workers: {}, rounding: null, debtChecked: [], debtAnswered: false, owedChecked: [], owedAnswered: false, owedChoice: {}, cashStepDone: false };

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
  const saleId = money.state.id;
  const draft = useCloseoutDraft(saleId);
  const groupId = groupOr();

  const ready = money.loaded && !!money.settlement && fin.events !== null && fin.state !== null;

  const derived = useMemo(() => {
    if (!ready || !money.settlement || !fin.state) return null;
    const s = money.settlement;
    const lines = (id: string) => (money.debts.get(id)?.payments ?? []).filter((p) => p.saleId === saleId && !p.deleted && p.counts);
    const repaymentOf = (id?: string) => (id ? fin.state!.repayments.find((r) => r.id === id && !r.deleted) : undefined);
    const owedOf = (id: string) => {
      const netted = lines(id).filter((p) => p.method === 'netting').map((p) => repaymentOf(p.repaymentId)).filter((r) => !!r);
      return fin.state!.reimbursements
        .filter((r) => r.to.id === id)
        .map((r) => ({ ...r, remainingSatang: r.remainingSatang + netted.reduce((a, rep) => a + rep.allocations.filter((x) => x.expenseId === r.expenseId).reduce((y, x) => y + x.satang, 0), 0) }));
    };
    const inputs: CloseoutWorkerInput[] = money.tappers.map((tp) => {
      const here = lines(tp.id);
      const total = here.reduce((a, p) => a + p.amountSatang, 0);
      const net = here.filter((p) => p.method === 'netting').reduce((a, p) => a + p.amountSatang, 0);
      const route = (here.find((p) => p.method !== 'netting' && p.method !== 'outside')?.method ?? null) as RepayRoute | null;
      return {
        id: tp.id,
        name: tp.name,
        shareSatang: Math.max(0, tp.shareSatang),
        balanceSatang: Math.max(0, (tp.account?.balanceSatang ?? 0) + total),
        planPerSaleSatang: tp.account?.planPerSaleSatang ?? null,
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
    const pieces = new Map(money.tappers.filter((tp) => tp.account).map((tp) => [tp.id, debtPieces(tp.account!, saleId, plan.workers.find((w) => w.id === tp.id)?.totalSatang ?? 0)]));
    const debtors = inputs.filter((w) => w.balanceSatang > 0).map((w) => ({ id: w.id, name: w.name }));
    const owed = inputs.filter((w) => w.owedBackSatang > 0).map((w) => ({ id: w.id, name: w.name, satang: w.owedBackSatang }));
    const over = money.tappers.some((tp) => overDeducted(tp.debtDeductedSatang + tp.nettedSatang, tp.shareSatang, tp.nettedSatang));
    const gate = confirmGate({
      debtors,
      debtChecked: new Set(draft.debtChecked),
      debtAnswered: draft.debtAnswered,
      owed,
      owedChecked: new Set(draft.owedChecked),
      owedAnswered: draft.owedAnswered,
      cashStepNeeded: plan.cashStepNeeded,
      cashStepDone: draft.cashStepDone,
      plan,
      over,
    });
    const recordedLines = (id: string): RecordedLine[] =>
      lines(id).map((p) => ({ id: p.id, headEventId: p.headEventId, method: p.method, amountSatang: p.amountSatang, repaymentId: p.repaymentId, repaymentHead: repaymentOf(p.repaymentId)?.headEventId }));
    // Every id ever written for this sale and worker, deleted ones too, so a new line never reuses a voided id.
    const knownIds = (id: string): string[] =>
      (money.debts.get(id)?.payments ?? []).filter((p) => p.saleId === saleId).flatMap((p) => [p.id, ...(p.repaymentId ? [p.repaymentId] : [])]);
    return { settlement: s, inputs, plan, pieces, debtors, owed, over, gate, recordedLines, owedOf, knownIds };
  }, [ready, money, fin.state, saleId, draft, store, groupId]);

  /** "ยืนยันยอด": write each worker's lines (existing event types), then rounding, then remember the choices. */
  const confirm = async (): Promise<boolean> => {
    let done = false;
    await flight.run(async () => {
      if (!derived || derived.gate.kind !== 'ready') return;
      const farm = { id: FARM_FUNDS, name: '' };
      for (const w of derived.plan.workers) {
        const res = confirmWrites({
          saleId,
          date: saleDay(money.state.startedTs, Date.now()),
          worker: { id: w.id, name: w.name },
          farm,
          plan: w,
          recorded: derived.recordedLines(w.id),
          owed: derived.owedOf(w.id),
          knownIds: derived.knownIds(w.id),
        });
        if (!res.ok) return;
        for (const x of res.writes) {
          if (x.op === 'write') await fin.write(x.id, null, x.payload);
          else if (x.op === 'void-repayment') await fin.write(x.id, x.base, { t: 'repayment_changed', patch: { deleted: true } });
          else await fin.write(x.id, x.base, { t: 'debt_payment_changed', patch: { deleted: true } });
        }
      }
      const r = derived.plan.rounding;
      if (derived.plan.hasFraction && (!money.rounding.choice.asked || money.rounding.choice.mode !== r)) {
        await fin.write(`sale-rounding-${saleId}`, money.rounding.choice.head, { t: 'sale_rounding_set', saleId, mode: r });
      }
      rememberCloseout(
        store,
        groupId,
        derived.plan.workers.filter((w) => w.routeSatang > 0).map((w) => ({ workerId: w.id, route: w.route })),
        derived.plan.hasFraction ? r : null,
      );
      clearDraft(saleId);
      fin.reload();
      done = true;
    });
    return done;
  };

  return { ready: !!derived, money, fin, saleId, draft, update: (f: (d: CloseoutDraft) => CloseoutDraft) => updateDraft(saleId, f), confirm, busy: flight.busy, ...(derived ?? {}) } as const;
}

export type Closeout = ReturnType<typeof useCloseout>;
