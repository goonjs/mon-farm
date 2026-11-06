import { describe, expect, it } from 'vitest';

import { closeoutInputs, closeoutPlan, REPAY_ROUTES } from './closeout';
import { projectDebts } from './debts';
import { projectFinance } from './ledger';
import {
  installmentAmount,
  installmentChoices,
  installmentProposal,
  installmentSplit,
  planPayload,
  planStatus,
  seenSnapshot,
} from './installments';
import { FARM_FUNDS, type DebtFields, type DebtPaymentFields, type FinanceEvent, type FinancePayload, type Payer } from './types';

/**
 * E06-S09 · instalment plans ("ผ่อนกี่งวด", D-88). Pure core: the amount per
 * instalment, the instalments already paid (counted from the log, never
 * stored), new debt since the plan, the choice of counts, the plan event.
 */

let n = 0;
function ev(targetId: string, payload: FinancePayload, opts: { base?: string | null; device?: string; seq?: number } = {}): FinanceEvent {
  n += 1;
  return {
    id: `i${String(n).padStart(5, '0')}`,
    groupId: 'group-1',
    deviceSeq: opts.seq ?? n,
    ts: n,
    actor: { userId: 'u', deviceId: opts.device ?? 'dev-a' },
    source: 'app',
    targetId,
    baseEventId: opts.base ?? null,
    payload,
  };
}

const FARM: Payer = { id: FARM_FUNDS, name: 'เงินสวน' };
const NAT: Payer = { id: 'p-nat', name: 'นัด' };

const debt = (id: string, amountSatang: number, over: Partial<DebtFields> = {}) =>
  ev(id, { t: 'debt_added', fields: { worker: NAT, kind: 'loan', amountSatang, date: '2026-10-01', note: '', lender: FARM, fertilizer: null, carriedForward: false, ...over } });
const pay = (id: string, saleId: string | null, amountSatang: number, over: Partial<DebtPaymentFields> & { device?: string } = {}) => {
  const { device, ...fields } = over;
  return ev(
    id,
    { t: 'debt_payment_recorded', fields: { worker: NAT, creditor: FARM, amountSatang, date: '2026-11-04', note: '', method: 'transfer-with-owner', saleId, ...fields } },
    { device },
  );
};
const voidPay = (id: string, base: string) => ev(id, { t: 'debt_payment_changed', patch: { deleted: true } }, { base });

const account = (events: FinanceEvent[], counts: (saleId: string) => boolean = () => true) => projectDebts(events, counts).get(NAT.id)!;

// ── IP-1 · the amount ─────────────────────────────────────────────────────────

describe('IP-1 · instalment = what is left ÷ instalments left, up to whole baht; the last one exact', () => {
  it('12,800.00 in 3 → 4,267 · 4,267 · 4,266', () => {
    expect(installmentSplit(1_280_000, 3)).toEqual([426_700, 426_700, 426_600]);
  });

  it('12,800.50 in 3 keeps the satang for the last one', () => {
    expect(installmentSplit(1_280_050, 3)).toEqual([426_700, 426_700, 426_650]);
  });

  it('one instalment left is the whole balance to the satang; nothing left or no debt is no instalment', () => {
    expect(installmentAmount(153_350, 1)).toBe(153_350);
    expect(installmentAmount(153_350, 0)).toBeNull();
    expect(installmentAmount(0, 3)).toBeNull();
  });

  it('never above the balance (a tiny debt over many instalments)', () => {
    expect(installmentAmount(150, 4)).toBe(100);
    expect(installmentSplit(150, 4).reduce((a, b) => a + b, 0)).toBe(150);
  });

  it('fuzz: 2,000 debts × 2–12 instalments add up exactly, none negative, whole baht but the last one paid', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648);
    for (let k = 0; k < 2_000; k++) {
      const balance = 1 + Math.floor(rnd() * 5_000_000);
      const count = 2 + Math.floor(rnd() * 11);
      const parts = installmentSplit(balance, count);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(balance);
      expect(parts.every((x) => x >= 0)).toBe(true);
      // A debt smaller than a baht per instalment finishes early (architect risk 4): trailing zeros, never a non-whole baht before the last part paid.
      const paid = parts.filter((x) => x > 0);
      expect(paid.slice(0, -1).every((x) => x % 100 === 0)).toBe(true);
    }
  });
});

// ── IP-7 · the choices ────────────────────────────────────────────────────────

describe('IP-7 · counts offered: 2 … max, never 1, never the count in place, at most 3, nearest first (more on a tie)', () => {
  it('no plan yet, max 4 → 2, 3, 4', () => {
    expect(installmentChoices(null, 4)).toEqual([2, 3, 4]);
  });
  it('2 left, max 4 → 3, 4', () => {
    expect(installmentChoices(2, 4)).toEqual([3, 4]);
  });
  it('3 left, max 5 → 2, 4, 5 (the owner\'s example)', () => {
    expect(installmentChoices(3, 5)).toEqual([2, 4, 5]);
  });
  it('6 left, max 12 → the three nearest, more instalments on a tie: 5, 7, 8', () => {
    expect(installmentChoices(6, 12)).toEqual([5, 7, 8]);
  });
  it('max is clamped to 2–12', () => {
    expect(installmentChoices(null, 1)).toEqual([2]);
    expect(installmentChoices(12, 40)).toEqual([9, 10, 11]);
  });
});

// ── the plan event ────────────────────────────────────────────────────────────

describe('the plan event (architect 2026-11-06): debt_plan_set with installments; perSaleSatang a fallback for old apps', () => {
  it('carries count, anchor sale, the devices seen and the debt owed; the fallback is the first instalment', () => {
    const p = planPayload({ worker: NAT, count: 3, fromSaleId: 's1', seen: { 'dev-a': 4 }, owedSatang: 1_280_000, balanceSatang: 1_280_000 });
    expect(p).toEqual({
      t: 'debt_plan_set',
      worker: NAT,
      perSaleSatang: 426_700,
      installments: { count: 3, fromSaleId: 's1', seen: { 'dev-a': 4 }, owedSatang: 1_280_000 },
    });
  });

  it('seenSnapshot is the highest deviceSeq per device in the log', () => {
    const es = [ev('x', { t: 'debt_plan_set', worker: NAT, perSaleSatang: null }, { device: 'a', seq: 3 }), ev('y', { t: 'debt_plan_set', worker: NAT, perSaleSatang: null }, { device: 'a', seq: 9 }), ev('z', { t: 'debt_plan_set', worker: NAT, perSaleSatang: null }, { device: 'b', seq: 2 })];
    expect(seenSnapshot(es)).toEqual({ a: 9, b: 2 });
  });

  it('projectDebts reads it: the instalment plan, and the fallback per-sale amount until the close-out reads the plan (review 5)', () => {
    const es = [debt('d1', 1_280_000), ev('plan-p-nat', planPayload({ worker: NAT, count: 3, fromSaleId: null, seen: {}, owedSatang: 1_280_000, balanceSatang: 1_280_000 }))];
    const a = account(es);
    expect(a.planPerSaleSatang).toBe(426_700);
    expect(a.installmentPlan).toEqual({ count: 3, fromSaleId: null, seen: {}, owedSatang: 1_280_000 });
  });

  it('IP-22 · a baht-per-sale plan reads as before', () => {
    const a = account([debt('d1', 1_000_000), ev('plan-p-nat', { t: 'debt_plan_set', worker: NAT, perSaleSatang: 325_000 })]);
    expect(a.planPerSaleSatang).toBe(325_000);
    expect(a.installmentPlan).toBeNull();
  });
});

// ── IP-3 · instalments paid, counted from the log ─────────────────────────────

/** Debt 12,800; plan set at sale s1 (instalment 1); `before` are events written before the plan. */
function planned(before: FinanceEvent[] = []) {
  const d = debt('d1', 1_280_000);
  const pre = [d, ...before];
  const plan = ev('plan-p-nat', planPayload({ worker: NAT, count: 3, fromSaleId: 's1', seen: seenSnapshot(pre), owedSatang: 1_280_000, balanceSatang: 1_280_000 }));
  return [...pre, plan];
}

describe('IP-3 · paid instalments: sales with a live deduction > 0 since the plan, one per sale', () => {
  it('the anchor sale is instalment 1; the next sale is instalment 2', () => {
    const es = [...planned(), pay('l1', 's1', 426_700), pay('l2', 's2', 426_700)];
    const st = planStatus({ account: account(es), events: es })!;
    expect(st.paid).toBe(2);
    expect(st.left).toBe(1);
    expect(st.paidSales.map((s) => s.saleId)).toEqual(['s1', 's2']);
  });

  it('the sale being closed is not counted (re-confirming it stays stable)', () => {
    const es = [...planned(), pay('l1', 's1', 426_700), pay('l2', 's2', 426_700)];
    const st = planStatus({ account: account(es), events: es, excludeSaleId: 's2' })!;
    expect(st.paid).toBe(1);
    expect(st.left).toBe(2);
  });

  it('a sale before the plan does not count, even re-confirmed after it (its first line was seen)', () => {
    const old = pay('l0', 's0', 100_000);
    const es = [...planned([old]), voidPay('l0', old.id), pay('l0b', 's0', 150_000), pay('l1', 's1', 426_700)];
    const st = planStatus({ account: account(es), events: es })!;
    expect(st.paidSales.map((s) => s.saleId)).toEqual(['s1']);
  });

  it('"ยังไม่หัก" (no line) and a line cut to 0 do not count; two lines at one sale count once', () => {
    const es = [...planned(), pay('l1', 's1', 426_700), pay('l2', 's2', 0), pay('l3a', 's3', 200_000), pay('l3b', 's3', 100_000, { method: 'netting' })];
    const st = planStatus({ account: account(es), events: es })!;
    expect(st.paidSales.map((s) => s.saleId)).toEqual(['s1', 's3']);
  });

  it('a payment outside a sale does not count as an instalment (it only lowers the balance)', () => {
    const es = [...planned(), pay('l1', 's1', 426_700), pay('o1', null, 100_000, { method: 'outside' })];
    expect(planStatus({ account: account(es), events: es })!.paid).toBe(1);
  });

  it('a cancelled sale drops out, and comes back when restored', () => {
    const es = [...planned(), pay('l1', 's1', 426_700), pay('l2', 's2', 426_700)];
    expect(planStatus({ account: account(es, (s) => s !== 's2'), events: es })!.paid).toBe(1);
    expect(planStatus({ account: account(es), events: es })!.paid).toBe(2);
  });

  it('two devices: a sale another device closed after the plan counts (its device seq is above what was seen)', () => {
    const es = [...planned(), pay('l1', 's1', 426_700), pay('l2', 's2', 426_700, { device: 'dev-b' })];
    expect(planStatus({ account: account(es), events: es })!.paid).toBe(2);
  });
});

// ── IP-4 / IP-5 · short, over, done ──────────────────────────────────────────

describe('IP-4 · a short or bigger deduction is still one instalment; the rest is spread over what is left', () => {
  it('3,000 at instalment 2 → the last one is 5,533', () => {
    const es = [...planned(), pay('l1', 's1', 426_700), pay('l2', 's2', 300_000)];
    const a = account(es);
    const st = planStatus({ account: a, events: es, excludeSaleId: 's3' })!;
    expect(st.left).toBe(1);
    expect(installmentProposal({ balanceSatang: a.balanceSatang, status: st })).toEqual({ satang: 553_300, needsChoice: false });
  });

  it('6,000 at instalment 2 → the last one is 2,533', () => {
    const es = [...planned(), pay('l1', 's1', 426_700), pay('l2', 's2', 600_000)];
    const a = account(es);
    const st = planStatus({ account: a, events: es, excludeSaleId: 's3' })!;
    expect(installmentProposal({ balanceSatang: a.balanceSatang, status: st }).satang).toBe(253_300);
  });
});

describe('IP-5 · the plan ends when the instalments run out or the debt is paid', () => {
  it('all 3 paid, 1,533 still owed → done; no instalment proposed (ordinary debt again)', () => {
    const es = [...planned(), pay('l1', 's1', 426_700), pay('l2', 's2', 300_000), pay('l3', 's3', 400_000)];
    const a = account(es);
    const st = planStatus({ account: a, events: es, excludeSaleId: 's4' })!;
    expect(a.balanceSatang).toBe(153_300);
    expect(st.done).toBe(true);
    expect(installmentProposal({ balanceSatang: a.balanceSatang, status: st })).toEqual({ satang: null, needsChoice: false });
  });

  it('paid off early → done', () => {
    const es = [...planned(), pay('l1', 's1', 1_280_000)];
    const a = account(es);
    expect(planStatus({ account: a, events: es, excludeSaleId: 's2' })!.done).toBe(true);
  });

  it('no plan → null', () => {
    const es = [debt('d1', 1_000)];
    expect(planStatus({ account: account(es), events: es })).toBeNull();
  });
});

// ── IP-6 · re-split ──────────────────────────────────────────────────────────

describe('IP-6 · re-splitting counts from today; instalments paid before are not counted', () => {
  it('after 2 paid, a new plan of 4 from sale s3 → 4 left at s3, 3 left at s4', () => {
    const base = [...planned(), pay('l1', 's1', 426_700), pay('l2', 's2', 426_700)];
    const a0 = account(base);
    const re = ev('plan-p-nat', planPayload({ worker: NAT, count: 4, fromSaleId: 's3', seen: seenSnapshot(base), owedSatang: 1_280_000, balanceSatang: a0.balanceSatang }), { base: base.find((e) => e.targetId === 'plan-p-nat')!.id });
    const es = [...base, re, pay('l3', 's3', 106_700)];
    expect(planStatus({ account: account(es), events: es, excludeSaleId: 's3' })!.left).toBe(4);
    expect(planStatus({ account: account(es), events: es, excludeSaleId: 's4' })!.left).toBe(3);
  });
});

// ── IP-8 · new debt during the plan ───────────────────────────────────────────

describe('IP-8 · new debt since the plan needs a choice; no default', () => {
  const withNew = () => {
    const es = [...planned(), pay('l1', 's1', 426_700), debt('d2', 200_000, { kind: 'fertilizer', date: '2026-11-08' })];
    const a = account(es);
    return { es, a, st: planStatus({ account: a, events: es, excludeSaleId: 's2' })! };
  };

  it('the extra is what the farm is owed now above what it was owed when the plan was set', () => {
    expect(withNew().st.extraSatang).toBe(200_000);
  });

  it('no choice yet → nothing proposed and a choice is needed', () => {
    const { a, st } = withNew();
    expect(installmentProposal({ balanceSatang: a.balanceSatang, status: st })).toEqual({ satang: null, needsChoice: true });
  });

  it('fold in → the whole 10,533 over the 2 left: 5,267', () => {
    const { a, st } = withNew();
    expect(installmentProposal({ balanceSatang: a.balanceSatang, status: st, newDebt: 'fold' })).toEqual({ satang: 526_700, needsChoice: false });
  });

  it('in full today → instalment 4,267 + 2,000 = 6,267', () => {
    const { a, st } = withNew();
    expect(installmentProposal({ balanceSatang: a.balanceSatang, status: st, newDebt: 'full' })).toEqual({ satang: 626_700, needsChoice: false });
  });

  it('a debt deleted since (extra below 0) just recomputes, no question', () => {
    const fresh = [...planned(), pay('l1', 's1', 426_700)];
    const edited = [...fresh, ev('d1', { t: 'debt_changed', patch: { amountSatang: 1_000_000 } }, { base: fresh[0].id })];
    const a = account(edited);
    const st = planStatus({ account: a, events: edited, excludeSaleId: 's2' })!;
    expect(st.extraSatang).toBeLessThan(0);
    expect(st.done).toBe(false);
    expect(installmentProposal({ balanceSatang: a.balanceSatang, status: st }).needsChoice).toBe(false);
  });
});

// ── review round 1 (2026-11-06) ──────────────────────────────────────────────

describe('review 1 · re-confirming the last instalment still proposes it (the balance is as if this sale had not deducted)', () => {
  it('s3 paid the rest to 0; re-opening s3 → 1 left, not over, proposes the same 4,266', () => {
    const es = [...planned(), pay('l1', 's1', 426_700), pay('l2', 's2', 426_700), pay('l3', 's3', 426_600)];
    const a = account(es);
    expect(a.balanceSatang).toBe(0);
    const st = planStatus({ account: a, events: es, excludeSaleId: 's3' })!;
    expect(st.done).toBe(false);
    expect(st.left).toBe(1);
    expect(installmentProposal({ balanceSatang: 426_600, status: st }).satang).toBe(426_600);
  });
});

describe('review 2 · a plan whose debt is paid stays over, even when new debt arrives (Q5: new debt is ordinary debt)', () => {
  it('paid off at s1, then a 2,000 fertilizer debt → over, no fold/full question', () => {
    const es = [...planned(), pay('l1', 's1', 1_280_000), debt('d2', 200_000, { kind: 'fertilizer' })];
    const a = account(es);
    const st = planStatus({ account: a, events: es, excludeSaleId: 's2' })!;
    expect(st.done).toBe(true);
    expect(installmentProposal({ balanceSatang: a.balanceSatang, status: st })).toEqual({ satang: null, needsChoice: false });
  });
  it('paid off outside a sale, then new debt → over too', () => {
    const es = [...planned(), pay('l1', 's1', 426_700), pay('o1', null, 853_300, { method: 'outside' }), debt('d2', 200_000)];
    const a = account(es);
    expect(planStatus({ account: a, events: es, excludeSaleId: 's2' })!.done).toBe(true);
  });
});

describe('review 4 · counting is per device and per sale', () => {
  it('another device\'s line written before the plan (inside `seen`) does not make its sale count', () => {
    const early = pay('b0', 's0', 100_000, { device: 'dev-b' });
    const es = [...planned([early]), pay('l1', 's1', 426_700)];
    expect(planStatus({ account: account(es), events: es })!.paidSales.map((x) => x.saleId)).toEqual(['s1']);
  });
  it('per device, not the highest seq: dev-b writes after the plan with a seq below dev-a\'s `seen` → it counts', () => {
    const bEarly = ev('b-x', { t: 'debt_plan_set', worker: { id: 'other', name: 'x' }, perSaleSatang: null }, { device: 'dev-b', seq: 1 });
    const base = planned([bEarly]); // seen = { dev-a: high, dev-b: 1 }
    const late = ev('b2', { t: 'debt_payment_recorded', fields: { worker: NAT, creditor: FARM, amountSatang: 100_000, date: '2026-11-12', note: '', method: 'transfer-with-owner', saleId: 's2' } }, { device: 'dev-b', seq: 2 });
    const es = [...base, pay('l1', 's1', 426_700), late];
    const plan = account(es).installmentPlan!;
    expect(plan.seen['dev-b']).toBe(1);
    expect(late.deviceSeq).toBeLessThan(plan.seen['dev-a']);
    expect(planStatus({ account: account(es), events: es })!.paidSales.map((x) => x.saleId)).toEqual(['s1', 's2']);
  });

  it('a device the plan never saw counts as after it (story Known risks)', () => {
    const es = [...planned(), pay('l1', 's1', 426_700), pay('c2', 's2', 100_000, { device: 'dev-new' })];
    expect(planStatus({ account: account(es), events: es })!.paid).toBe(2);
  });
  it('one sale with lines from two devices is one instalment', () => {
    const es = [...planned(), pay('l1', 's1', 426_700), pay('a2', 's2', 200_000), pay('b2', 's2', 100_000, { device: 'dev-b' })];
    const st = planStatus({ account: account(es), events: es })!;
    expect(st.paid).toBe(2);
    expect(st.paidSales[1]).toMatchObject({ saleId: 's2', satang: 300_000 });
  });
  it('a payment at a sale to another lender is not an instalment; a netting-only sale is', () => {
    const OTHER: Payer = { id: 'p-other', name: 'ลุง' };
    const es = [...planned(), pay('l1', 's1', 426_700), pay('x2', 's2', 50_000, { creditor: OTHER }), pay('n3', 's3', 64_000, { method: 'netting' })];
    expect(planStatus({ account: account(es), events: es })!.paidSales.map((x) => x.saleId)).toEqual(['s1', 's3']);
  });
  it('the anchor sale cancelled: instalment 1 drops out, the plan stays', () => {
    const es = [...planned(), pay('l1', 's1', 426_700)];
    const st = planStatus({ account: account(es, (x) => x !== 's1'), events: es })!;
    expect(st.paid).toBe(0);
    expect(st.left).toBe(3);
  });
});

// ── PR-b · the close-out reads the plan from the log ──────────────────────────

describe('closeoutInputs carries the plan (as of this sale) into the close-out', () => {
  const inputsFor = (es: FinanceEvent[], saleId: string, maxInstallments?: number) =>
    closeoutInputs({ saleId, tappers: [{ id: NAT.id, name: NAT.name, shareSatang: 3_850_000 }], accounts: projectDebts(es), finance: projectFinance(es), events: es, maxInstallments }).inputs[0];

  it('re-confirming instalment 2: status as if s2 deducted nothing, the farm max, owed now', () => {
    const es = [...planned(), pay('l1', 's1', 426_700), pay('l2', 's2', 426_700)];
    const w = inputsFor(es, 's2', 6);
    expect(w.balanceSatang).toBe(853_300);
    expect(w.installment).toMatchObject({ max: 6, owedSatang: 1_280_000, status: { paid: 1, left: 2, done: false } });
    const plan = closeoutPlan({ saleTotalSatang: 10_000_000, ownerShareSatang: 6_150_000, workers: [w], drafts: {}, defaultRoute: () => REPAY_ROUTES[0], rounding: 'none' });
    expect(plan.workers[0].proposedSatang).toBe(426_700);
  });

  it('no plan → a null status; no max given → the default 4', () => {
    const es = [debt('d1', 500_000)];
    expect(inputsFor(es, 's1').installment).toEqual({ status: null, max: 4, owedSatang: 500_000 });
  });
});

describe('a re-split / re-base keeps the instalments already paid (the number does not restart after confirm)', () => {
  it('re-split to 4 more at s2 (1 paid at s1): written as 5 with s1 earlier → s2 re-confirmed is "2 of 5"', () => {
    const base = [...planned(), pay('l1', 's1', 426_700)];
    const earlier = planStatus({ account: account(base), events: base, excludeSaleId: 's2' })!.paidSales;
    const plan2 = ev('plan-p-nat', planPayload({ worker: NAT, count: 5, earlier, fromSaleId: 's2', seen: seenSnapshot(base), owedSatang: 1_280_000, balanceSatang: 853_300 }), { base: base[base.length - 2].id });
    const es = [...base, plan2, pay('l2', 's2', 213_400)];
    const st = planStatus({ account: account(es), events: es, excludeSaleId: 's2' })!;
    expect(st.paidSales.map((s) => s.saleId)).toEqual(['s1']);
    expect(st.paid).toBe(1);
    expect(st.left).toBe(4);
    const after = planStatus({ account: account(es), events: es })!;
    expect(after.paid).toBe(2);
    expect(after.left).toBe(3);
  });

  it('a plan with no earlier instalments writes none (the event stays as before)', () => {
    const p = planPayload({ worker: NAT, count: 3, earlier: [], fromSaleId: 's1', seen: {}, owedSatang: 1, balanceSatang: 1 });
    expect(p.t === 'debt_plan_set' && p.installments).toEqual({ count: 3, fromSaleId: 's1', seen: {}, owedSatang: 1 });
  });
});
