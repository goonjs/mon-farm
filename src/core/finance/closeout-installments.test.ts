import { describe, expect, it } from 'vitest';

import { closeoutPlan, confirmGate, planWrite, REPAY_ROUTES, type CloseoutInput, type CloseoutWorkerDraft, type CloseoutWorkerInput } from './closeout';
import type { PlanStatus } from './installments';
import type { InstallmentPlanSpec, Payer } from './types';

/**
 * E06-S09 PR-b · the close-out reads instalment plans (IP-9…IP-15 core):
 * the proposal follows the plan, a count picked in the sheet (new plan or
 * re-split), new debt gates confirm until fold / in full is chosen, and the
 * plan event written with the confirm.
 */

const NAT: Payer = { id: 'p-nat', name: 'นัด' };
const SPEC: InstallmentPlanSpec = { count: 3, fromSaleId: 's1', seen: { 'dev-a': 10 }, owedSatang: 1_280_000 };

/** A running plan: 12,800 in 3, instalment 1 paid at s1 (8,533 left). */
const running = (over: Partial<PlanStatus> = {}): PlanStatus => ({
  plan: SPEC,
  paidSales: [{ saleId: 's1', date: '2026-11-04', satang: 426_700 }],
  paid: 1,
  left: 2,
  extraSatang: 0,
  done: false,
  ...over,
});

function nat(over: Partial<CloseoutWorkerInput> = {}): CloseoutWorkerInput {
  return {
    id: NAT.id,
    name: 'นัด',
    shareSatang: 3_850_000,
    balanceSatang: 853_300,
    planPerSaleSatang: 426_700, // the fallback an instalment plan carries — must be ignored
    owedBackSatang: 0,
    recorded: null,
    installment: { status: running(), max: 4, owedSatang: 1_280_000 },
    ...over,
  };
}

const input = (w: CloseoutWorkerInput, draft?: CloseoutWorkerDraft): CloseoutInput => ({
  saleTotalSatang: 10_000_000,
  ownerShareSatang: 10_000_000 - w.shareSatang,
  workers: [w],
  drafts: draft ? { [w.id]: draft } : {},
  defaultRoute: () => REPAY_ROUTES[0],
  rounding: 'none',
});
const one = (w: CloseoutWorkerInput, draft?: CloseoutWorkerDraft) => closeoutPlan(input(w, draft)).workers[0];

describe('IP-11 · a running plan proposes this sale\'s instalment', () => {
  it('instalment 2 of 3 → 4,267; the view says 2 of 3, what was paid, and the last one 4,266', () => {
    const w = one(nat());
    expect(w.proposedSatang).toBe(426_700);
    expect(w.totalSatang).toBe(426_700);
    expect(w.reason).toBe('plan');
    expect(w.installment).toMatchObject({ mode: 'running', number: 2, count: 3, needsChoice: false, nextSatang: [426_600] });
    expect(w.installment!.paidSales).toEqual([{ saleId: 's1', date: '2026-11-04', satang: 426_700 }]);
  });

  it('the counts offered for a re-split: 2 left, max 4 → 3, 4 (IP-7)', () => {
    expect(one(nat()).installmentChoices).toEqual([3, 4]);
  });
});

describe('IP-12 · the share is short of the instalment: what it can take, and the rest moves to the last one', () => {
  it('share 3,000 → 3,000; the last one 5,533', () => {
    const w = one(nat({ shareSatang: 300_000 }));
    expect(w.totalSatang).toBe(300_000);
    expect(w.installment!.nextSatang).toEqual([553_300]);
  });
});

describe('IP-5 · a plan that is over proposes as without a plan (the fallback per-sale amount is ignored)', () => {
  it('done → the whole debt, capped by the share; no instalment view; offered 2, 3, 4', () => {
    const w = one(nat({ balanceSatang: 153_300, installment: { status: running({ paid: 3, left: 0, done: true }), max: 4, owedSatang: 1_280_000 } }));
    expect(w.proposedSatang).toBe(153_300);
    expect(w.reason).toBe('all');
    expect(w.installment).toBeNull();
    expect(w.installmentChoices).toEqual([2, 3, 4]);
  });
});

describe('IP-9 / IP-10 · no plan yet: a count picked in the sheet makes the first instalment', () => {
  const fresh = () => nat({ balanceSatang: 1_280_000, planPerSaleSatang: null, installment: { status: null, max: 4, owedSatang: 1_280_000 } });

  it('no pick → the old rule (the whole debt, capped); offered 2, 3, 4', () => {
    const w = one(fresh());
    expect(w.proposedSatang).toBe(1_280_000);
    expect(w.installment).toBeNull();
    expect(w.installmentChoices).toEqual([2, 3, 4]);
  });

  it('3 picked → 4,267 now, "1 of 3", then 4,267 · 4,266', () => {
    const w = one(fresh(), { installments: 3 });
    expect(w.totalSatang).toBe(426_700);
    expect(w.installment).toMatchObject({ mode: 'new', number: 1, count: 3, nextSatang: [426_700, 426_600] });
  });

  it('a typed amount still wins over the pick (ใส่ยอดเอง)', () => {
    expect(one(fresh(), { installments: 3, totalSatang: 500_000 }).totalSatang).toBe(500_000);
  });
});

describe('IP-6 · re-split at a sale: counted from today', () => {
  it('4 picked with 1 paid → 8,533 over 4 = 2,134 now; "2 of 5"', () => {
    const w = one(nat(), { installments: 4 });
    expect(w.totalSatang).toBe(213_400);
    expect(w.installment).toMatchObject({ mode: 'resplit', number: 2, count: 5 });
    expect(w.installment!.nextSatang).toEqual([213_300, 213_300, 213_300]);
  });
});

describe('IP-8 / IP-13 · new debt since the plan: nothing proposed and confirm gated until fold / in full', () => {
  const withNew = () => nat({ balanceSatang: 1_053_300, installment: { status: running({ extraSatang: 200_000 }), max: 4, owedSatang: 1_480_000 } });

  it('no choice → 0 proposed, needsChoice, the gate names the worker', () => {
    const plan = closeoutPlan(input(withNew()));
    expect(plan.workers[0].totalSatang).toBe(0);
    expect(plan.workers[0].installment!.needsChoice).toBe(true);
    const gate = confirmGate({ debtors: [{ id: NAT.id, name: 'นัด' }], debtChecked: new Set([NAT.id]), debtAnswered: false, owed: [], owedChecked: new Set(), owedAnswered: true, plan });
    expect(gate).toEqual({ kind: 'new-debt', names: ['นัด'] });
  });

  it('fold → 5,267; in full → 6,267 (the last one stays 4,266)', () => {
    expect(one(withNew(), { newDebt: 'fold' }).totalSatang).toBe(526_700);
    const full = one(withNew(), { newDebt: 'full' });
    expect(full.totalSatang).toBe(626_700);
    expect(full.installment!.nextSatang).toEqual([426_600]);
  });

  it('closing the whole debt, or "ยังไม่หัก", also answers it (a typed amount): no gate', () => {
    expect(one(withNew(), { totalSatang: 1_053_300 }).installment!.needsChoice).toBe(false);
    expect(one(withNew(), { totalSatang: 0 }).installment!.needsChoice).toBe(false);
  });
});

describe('the plan event written with the confirm (architect: same confirm as the lines)', () => {
  const seen = { 'dev-a': 12 };

  it('a count picked for a worker with no plan → plan of 3 from this sale', () => {
    const w = nat({ balanceSatang: 1_280_000, planPerSaleSatang: null, installment: { status: null, max: 4, owedSatang: 1_280_000 } });
    expect(planWrite({ worker: NAT, input: w, draft: { installments: 3 }, saleId: 's9', seen })).toEqual({
      t: 'debt_plan_set',
      worker: NAT,
      perSaleSatang: 426_700,
      installments: { count: 3, fromSaleId: 's9', seen, owedSatang: 1_280_000 },
    });
  });

  it('a new-debt choice re-baselines: the same 3 instalments, instalment 1 kept as earlier, owed now', () => {
    const w = nat({ balanceSatang: 1_053_300, installment: { status: running({ extraSatang: 200_000 }), max: 4, owedSatang: 1_480_000 } });
    const p = planWrite({ worker: NAT, input: w, draft: { newDebt: 'fold' }, saleId: 's2', seen });
    expect(p).toMatchObject({ perSaleSatang: 526_700, installments: { count: 3, earlier: [{ saleId: 's1', satang: 426_700 }], fromSaleId: 's2', owedSatang: 1_480_000 } });
  });

  it('a re-split at s2 to 4 more: written as 5 with instalment 1 earlier', () => {
    const p = planWrite({ worker: NAT, input: nat(), draft: { installments: 4 }, saleId: 's2', seen });
    expect(p).toMatchObject({ perSaleSatang: 213_400, installments: { count: 5, earlier: [{ saleId: 's1' }], fromSaleId: 's2' } });
  });

  it('a confirm pressed again after the plan landed writes no second plan (same count, sale and owed)', () => {
    const landed: PlanStatus = { plan: { count: 5, earlier: [{ saleId: 's1', date: '2026-11-04', satang: 426_700 }], fromSaleId: 's2', seen, owedSatang: 1_280_000 }, paidSales: [{ saleId: 's1', date: '2026-11-04', satang: 426_700 }], paid: 1, left: 4, extraSatang: 0, done: false };
    expect(planWrite({ worker: NAT, input: nat({ installment: { status: landed, max: 6, owedSatang: 1_280_000 } }), draft: { installments: 4 }, saleId: 's2', seen })).toBeNull();
    expect(planWrite({ worker: NAT, input: nat({ installment: { status: landed, max: 6, owedSatang: 1_280_000 } }), draft: { installments: 3 }, saleId: 's2', seen })).not.toBeNull();
  });

  it('nothing picked → nothing written; a plan that is over is not re-written', () => {
    expect(planWrite({ worker: NAT, input: nat(), draft: undefined, saleId: 's2', seen })).toBeNull();
    expect(planWrite({ worker: NAT, input: nat(), draft: { totalSatang: 100_000 }, saleId: 's2', seen })).toBeNull();
  });
});
