import { beforeAll, describe, expect, it } from 'vitest';

import {
  breakPlan,
  closeoutInputs,
  closeoutPlan,
  confirmGate,
  confirmWrites,
  debtPieces,
  groupNotes,
  liftableNotes,
  netDraft,
  payBlocks,
  pendingRepays,
  quickAmounts,
  REPAY_ROUTES,
  ROUNDING_MENU,
  sourcesSheet,
  staleChecks,
  type CloseoutInput,
  type CloseoutPlan,
  type CloseoutWorker,
  type CloseoutWorkerInput,
  type RecordedLine,
} from './closeout';
import type { Debt, DebtAccount, DebtPayment } from './debts';
import { projectDebts } from './debts';
import { cashNotes, deductSheet, needsChange, nettingPayloads, overDeducted, pickNotes, roundCash, type RoundingMode } from './deduct';
import { projectFinance } from './ledger';
import type { Reimbursement } from './ledger';
import { roundSettlement } from './rounding';
import { FARM_FUNDS, type DebtKind, type DebtPaymentMethod, type FinanceEvent, type FinancePayload, type Payer } from './types';

const DAENG: Payer = { id: 'p-daeng', name: 'แดง' };
const NAT: Payer = { id: 'p-nat', name: 'นัด' };
const FARM: Payer = { id: FARM_FUNDS, name: '' };
const SALE = 's-1';

// ── fixtures ────────────────────────────────────────────────────────────────

let seq = 0;
function debt(kind: DebtKind, date: string, amountSatang: number, extra: Partial<Debt> = {}): Debt {
  seq += 1;
  return {
    id: extra.id ?? `d-${date}-${seq}`,
    worker: DAENG,
    kind,
    amountSatang,
    date,
    note: '',
    lender: null,
    fertilizer: null,
    deleted: false,
    headEventId: `h-${seq}`,
    ...extra,
  } as Debt;
}
function payment(amountSatang: number, date: string, extra: Partial<DebtPayment> = {}): DebtPayment {
  seq += 1;
  return {
    id: `dp-${seq}`,
    worker: DAENG,
    creditor: FARM,
    amountSatang,
    date,
    note: '',
    method: 'transfer-with-owner',
    saleId: 's-old',
    deleted: false,
    headEventId: `hp-${seq}`,
    counts: true,
    ...extra,
  } as DebtPayment;
}
function account(debts: Debt[], payments: DebtPayment[] = []): DebtAccount {
  return { worker: DAENG, debts, payments } as unknown as DebtAccount;
}

const daengDebts = () => [
  debt('loan', '2026-09-01', 600000, { id: 'd-loan' }),
  debt('fertilizer', '2026-09-28', 579000, { id: 'd-fert1' }),
  debt('fertilizer', '2026-10-05', 400000, { id: 'd-fert2' }),
];

function worker(over: Partial<CloseoutWorkerInput> & { id: string }): CloseoutWorkerInput {
  return {
    name: over.id,
    shareSatang: 0,
    balanceSatang: 0,
    planPerSaleSatang: null,
    owedBackSatang: 0,
    recorded: null,
    ...over,
  };
}

const storyInput = (over: Partial<CloseoutInput> = {}): CloseoutInput => ({
  saleTotalSatang: 2887500,
  ownerShareSatang: 1443750,
  workers: [
    worker({
      id: DAENG.id,
      name: 'แดง',
      shareSatang: 918750,
      balanceSatang: 1579000,
      planPerSaleSatang: 325000,
    }),
    worker({
      id: NAT.id,
      name: 'นัด',
      shareSatang: 525000,
      balanceSatang: 835000,
    }),
  ],
  drafts: {},
  defaultRoute: () => 'transfer-with-owner',
  rounding: 'worker',
  ...over,
});

const byId = (p: CloseoutPlan, id: string) => p.workers.find((w) => w.id === id)!;
/** A deterministic id factory for tests: `dpay-1`, `rep-2`, … (the app passes `newId`, a UUIDv7). */
const counter = () => {
  let k = 0;
  return (prefix: string) => `${prefix}${++k}`;
};

// ── CO-22 ───────────────────────────────────────────────────────────────────

describe('the transfer split (D-85): the farm share before rounding, the rounding, the repayment', () => {
  it('story: 14,437.50 − 0.50 + 8,500.00 = 22,937.00', () => {
    const p = closeoutPlan(storyInput());
    expect(p.ownerShareSatang).toBe(1443750);
    expect(p.ownerSatang - p.ownerShareSatang).toBe(-50);
    expect(p.transferRepaySatang).toBe(850000);
    expect(p.ownerShareSatang + (p.ownerSatang - p.ownerShareSatang) + p.transferRepaySatang).toBe(p.transferSatang);
  });
});

describe('debtPieces (CO-22, D-67, D-69)', () => {
  it('deduct 3,250 from แดง 6,000 / 5,790 / 4,000 → oldest first, first left 2,750, Σ left 12,540', () => {
    const p = debtPieces(account(daengDebts()), SALE, 325000);
    expect(p.map((x) => x.id)).toEqual(['d-loan', 'd-fert1', 'd-fert2']);
    expect(p[0]).toMatchObject({
      kind: 'loan',
      leftBeforeSatang: 600000,
      leftAfterSatang: 275000,
    });
    expect(p[1].leftAfterSatang).toBe(579000);
    expect(p.reduce((a, x) => a + x.leftAfterSatang, 0)).toBe(1254000);
  });

  it('sorts by (date, id) whatever the input order', () => {
    const [a, b, c] = daengDebts();
    expect(debtPieces(account([c, a, b]), SALE, 0).map((x) => x.id)).toEqual(['d-loan', 'd-fert1', 'd-fert2']);
  });

  it('payments from other sales go oldest first before; pieces paid off before are left out', () => {
    // 7,000 paid elsewhere: the loan (6,000) is gone, fert1 has 4,790 left before this sale.
    const p = debtPieces(account(daengDebts(), [payment(500000, '2026-10-01'), payment(200000, '2026-10-02', { saleId: null, method: 'outside' })]), SALE, 325000);
    expect(p.map((x) => x.id)).toEqual(['d-fert1', 'd-fert2']);
    expect(p[0]).toMatchObject({
      leftBeforeSatang: 479000,
      leftAfterSatang: 154000,
    });
    expect(p[1]).toMatchObject({
      leftBeforeSatang: 400000,
      leftAfterSatang: 400000,
    });
  });

  it("this sale's own payments, deleted / not-counting payments and other lenders' payments are ignored", () => {
    const p = debtPieces(
      account(daengDebts(), [
        payment(325000, '2026-10-31', { saleId: SALE }),
        payment(100000, '2026-10-01', { deleted: true }),
        payment(100000, '2026-10-01', { counts: false }),
        payment(100000, '2026-10-01', {
          creditor: { id: 'p-aunt', name: 'ป้า' },
          method: 'outside',
          saleId: null,
        }),
      ]),
      SALE,
      0,
    );
    expect(p[0].leftBeforeSatang).toBe(600000);
  });

  it('non-farm loans (lender ≠ FARM_FUNDS) and deleted debts are not pieces', () => {
    const p = debtPieces(
      account([
        ...daengDebts(),
        debt('loan', '2026-08-01', 99900, {
          lender: { id: 'p-aunt', name: 'ป้า' },
        }),
        debt('other', '2026-08-02', 5000, { deleted: true }),
      ]),
      SALE,
      0,
    );
    expect(p.map((x) => x.id)).toEqual(['d-loan', 'd-fert1', 'd-fert2']);
    // A loan from the farm by name is deductible.
    const farmLoan = debtPieces(account([debt('loan', '2026-08-01', 1000, { lender: FARM })]), SALE, 0);
    expect(farmLoan).toHaveLength(1);
  });
});

// ── the story example ───────────────────────────────────────────────────────

describe('closeoutPlan — story example (28,875.00)', () => {
  let plan: CloseoutPlan;
  beforeAll(() => {
    plan = closeoutPlan(storyInput());
  });

  it('แดง: plan 3,250, cash 5,938.00 after +0.50', () => {
    expect(byId(plan, DAENG.id)).toMatchObject({
      hasDebt: true,
      proposedSatang: 325000,
      reason: 'plan',
      totalSatang: 325000,
      routeSatang: 325000,
      route: 'transfer-with-owner',
      cashBeforeSatang: 593750,
      adjustSatang: 50,
      cashSatang: 593800,
      debtLeftSatang: 1254000,
      leftChip: false,
      invalid: false,
      dirty: true,
    });
  });

  it('นัด: cut at the share 5,250, cash 0, chip with 3,100 left', () => {
    expect(byId(plan, NAT.id)).toMatchObject({
      totalSatang: 525000,
      reason: 'cut',
      capSatang: 525000,
      cashSatang: 0,
      debtLeftSatang: 310000,
      leftChip: true,
    });
  });

  it('owner 14,437.00; transfer 22,937.00 of which repay 8,500; tally ok', () => {
    expect(plan.ownerSatang).toBe(1443700);
    expect(plan.transferRepaySatang).toBe(850000);
    expect(plan.transferSatang).toBe(2293700);
    expect(plan.buyerSplitSatang).toBe(0);
    expect(plan.pickedSatang).toBe(0);
    expect(plan.tally).toEqual({ ok: true, diffSatang: 0, sumSatang: 2887500 });
    expect(plan.hasFraction).toBe(true);
    expect(plan.cashStepNeeded).toBe(true);
    expect(plan.anyInvalid).toBe(false);
  });

  it("reason 'all' when the whole balance fits in the share; no debt → no deduction", () => {
    const p = closeoutPlan(
      storyInput({
        workers: [worker({ id: 'a', shareSatang: 500000, balanceSatang: 120000 }), worker({ id: 'b', shareSatang: 500000 })],
        saleTotalSatang: 2000000,
        ownerShareSatang: 1000000,
      }),
    );
    expect(byId(p, 'a')).toMatchObject({
      reason: 'all',
      totalSatang: 120000,
      debtLeftSatang: 0,
      leftChip: false,
    });
    expect(byId(p, 'b')).toMatchObject({
      hasDebt: false,
      totalSatang: 0,
      routeSatang: 0,
      cashSatang: 500000,
      leftChip: false,
      dirty: false,
    });
  });

  it('menus keep the CO-19 order', () => {
    expect(REPAY_ROUTES).toEqual(['transfer-with-owner', 'buyer-split', 'cash-from-share']);
    expect(ROUNDING_MENU).toEqual(['worker', 'none', 'owner']);
  });
});

// ── ไม่เปลี่ยน ──────────────────────────────────────────────────────────────

describe('ไม่เปลี่ยน: same numbers as deductSheet / roundCash, Σ = sale to the satang', () => {
  const shares = [0, 1, 99, 5050, 918750, 525000, 333333];
  const balances = [0, 1, 4999, 325000, 835000, 1579000];
  const plans = [null, 100050, 325000];
  const owedBacks = [0, 64000];
  const roundings: RoundingMode[] = ['worker', 'none', 'owner'];

  it('every route × rounding × netting on/off × share/balance', () => {
    let cases = 0;
    for (const route of REPAY_ROUTES)
      for (const rounding of roundings)
        for (const net of [false, true])
          for (const s1 of shares)
            for (const b1 of balances)
              for (const plan1 of plans)
                for (const owed of owedBacks) {
                  const s2 = 287550;
                  const b2 = 100025;
                  const owner = 1234567;
                  const ws = [
                    worker({
                      id: 'w1',
                      shareSatang: s1,
                      balanceSatang: b1,
                      planPerSaleSatang: plan1,
                      owedBackSatang: owed,
                    }),
                    worker({
                      id: 'w2',
                      shareSatang: s2,
                      balanceSatang: b2,
                      owedBackSatang: owed,
                    }),
                    worker({ id: 'w3', shareSatang: 77777 }),
                  ];
                  const netting = (w: CloseoutWorkerInput) => (net ? Math.min(w.owedBackSatang, w.balanceSatang) : 0);
                  const drafts = Object.fromEntries(ws.map((w) => [w.id, { nettingSatang: netting(w) }]));
                  const sale = s1 + s2 + 77777 + owner;
                  const p = closeoutPlan({
                    saleTotalSatang: sale,
                    ownerShareSatang: owner,
                    workers: ws,
                    drafts,
                    defaultRoute: () => route,
                    rounding,
                  });
                  cases += 1;
                  expect(p.tally.ok).toBe(true);
                  expect(p.workers.reduce((a, w) => a + w.cashSatang, 0) + p.transferSatang + p.buyerSplitSatang + p.pickedSatang).toBe(sale);
                  const rounded = roundSettlement(
                    p.workers.map((w) => ({
                      id: w.id,
                      cashBeforeSatang: w.cashBeforeSatang,
                    })),
                    rounding,
                    owner,
                  );
                  expect(p.ownerSatang).toBe(rounded.ownerSatang);
                  expect(p.hasFraction).toBe(rounded.needsAsking);
                  for (const w of ws) {
                    const got = byId(p, w.id);
                    const sheet = deductSheet({
                      balanceSatang: w.balanceSatang,
                      shareSatang: w.shareSatang,
                      owedBackSatang: w.owedBackSatang,
                      planPerSaleSatang: w.planPerSaleSatang,
                      totalSatang: null,
                      nettingSatang: netting(w),
                    });
                    expect(got.cashSatang).toBeGreaterThanOrEqual(0);
                    expect(got.totalSatang).toBeLessThanOrEqual(got.capSatang);
                    expect(got.invalid).toBe(false);
                    expect(got.proposedSatang).toBe(sheet.proposedSatang);
                    expect(got.capSatang).toBe(sheet.capSatang);
                    expect(got.netCapSatang).toBe(sheet.netCapSatang);
                    expect(got.totalSatang).toBe(sheet.totalSatang);
                    expect(got.nettingSatang).toBe(sheet.nettingSatang);
                    expect(got.routeSatang).toBe(sheet.routeSatang);
                    expect(got.cashBeforeSatang).toBe(sheet.cashSatang);
                    expect(got.debtLeftSatang).toBe(sheet.debtLeftSatang);
                    expect({
                      cashSatang: got.cashSatang,
                      adjustSatang: got.adjustSatang,
                    }).toEqual(roundCash(got.cashBeforeSatang, rounding));
                    expect(got.route).toBe(route);
                  }
                  const routeSum = (r: string) => p.workers.filter((w) => w.route === r).reduce((a, w) => a + w.routeSatang, 0);
                  expect(p.transferRepaySatang).toBe(routeSum('transfer-with-owner'));
                  expect(p.buyerSplitSatang).toBe(routeSum('buyer-split'));
                  expect(p.pickedSatang).toBe(routeSum('cash-from-share'));
                  expect(p.transferSatang).toBe(p.ownerSatang + p.transferRepaySatang);
                }
    expect(cases).toBeGreaterThan(1000);
  });

  it('the sources sheet adds up for every route', () => {
    for (const route of REPAY_ROUTES) {
      const p = closeoutPlan(storyInput({ defaultRoute: () => route }));
      const s = sourcesSheet(p, 2887500, 1443750);
      expect([s.shares.ok, s.debt.ok, s.rounding.ok, s.paid.ok]).toEqual([true, true, true, true]);
    }
  });
});

// ── drafts ──────────────────────────────────────────────────────────────────

describe('drafts (CO-3, CO-5)', () => {
  const one = (w: Partial<CloseoutWorkerInput>, d: CloseoutInput['drafts'][string] = {}) =>
    byId(
      closeoutPlan({
        saleTotalSatang: 0,
        ownerShareSatang: 0,
        workers: [worker({ id: 'w', shareSatang: 525000, balanceSatang: 835000, ...w })],
        drafts: { w: d },
        defaultRoute: () => 'buyer-split',
        rounding: 'none',
      }),
      'w',
    );

  it('null total follows the proposal; 0 = none', () => {
    expect(one({}, { totalSatang: null }).totalSatang).toBe(525000);
    const none = one({}, { totalSatang: 0 });
    expect(none).toMatchObject({
      totalSatang: 0,
      routeSatang: 0,
      cashSatang: 525000,
      debtLeftSatang: 835000,
      invalid: false,
      dirty: false,
    });
  });

  it('the problem is named: above the cap → total-range; below the netting → below-netting (review #8)', () => {
    const p = closeoutPlan(storyInput({ workers: storyInput().workers.map((w) => (w.id === NAT.id ? { ...w, owedBackSatang: 64000 } : w)), drafts: { [NAT.id]: { nettingSatang: 64000, totalSatang: 50000 } } }));
    expect(byId(p, NAT.id).problem).toBe('below-netting');
    const q = closeoutPlan(storyInput({ drafts: { [NAT.id]: { totalSatang: 600000 } } }));
    expect(byId(q, NAT.id).problem).toBe('total-range');
    expect(byId(closeoutPlan(storyInput()), NAT.id).problem).toBeNull();
  });
  it('over the cap → invalid; below netting → invalid', () => {
    expect(one({}, { totalSatang: 525001 }).invalid).toBe(true);
    expect(one({}, { totalSatang: -1 }).invalid).toBe(true);
    expect(one({ owedBackSatang: 64000 }, { totalSatang: 589000, nettingSatang: 64000 }).invalid).toBe(false);
    expect(one({ owedBackSatang: 64000 }, { totalSatang: 50000, nettingSatang: 64000 }).invalid).toBe(true);
    expect(one({ owedBackSatang: 64000 }, { nettingSatang: 64001 }).invalid).toBe(true);
  });

  it('netting widens the cap and leaves only the difference to the route', () => {
    const w = one({ owedBackSatang: 64000 }, { nettingSatang: 64000 });
    expect(w).toMatchObject({
      capSatang: 589000,
      totalSatang: 589000,
      nettingSatang: 64000,
      routeSatang: 525000,
      cashSatang: 0,
    });
  });

  it('recorded lines are the starting point when there is no draft; dirty only when they differ', () => {
    const recorded = {
      totalSatang: 300000,
      nettingSatang: 0,
      route: 'cash-from-share' as const,
    };
    const w = one({ recorded }, undefined);
    expect(w).toMatchObject({
      totalSatang: 300000,
      route: 'cash-from-share',
      dirty: false,
    });
    expect(one({ recorded }, { totalSatang: 300000 }).dirty).toBe(false);
    expect(one({ recorded }, { totalSatang: 300001 }).dirty).toBe(true);
    expect(one({ recorded }, { route: 'buyer-split' }).dirty).toBe(true);
    expect(one({ recorded }, { totalSatang: null }).totalSatang).toBe(525000);
    expect(
      one({
        recorded: { totalSatang: 64000, nettingSatang: 64000, route: null },
        owedBackSatang: 64000,
      }).dirty,
    ).toBe(false);
    // The draft's route wins over the recorded one and the preference.
    expect(one({}, { route: 'transfer-with-owner' }).route).toBe('transfer-with-owner');
    expect(one({}).route).toBe('buyer-split');
  });

  it('quickAmounts: full / half floored to whole baht / none', () => {
    expect(quickAmounts(525000)).toEqual({
      full: 525000,
      half: 262500,
      none: 0,
    });
    expect(quickAmounts(525050)).toEqual({
      full: 525050,
      half: 262500,
      none: 0,
    });
    expect(quickAmounts(100)).toEqual({ full: 100, half: 0, none: 0 });
    expect(quickAmounts(300)).toEqual({ full: 300, half: 100, none: 0 });
    expect(quickAmounts(0)).toEqual({ full: 0, half: 0, none: 0 });
  });
});

describe('netDraft (CO-7, owner Q1: partial netting)', () => {
  // นัด: share 5,250, debt 8,350, the farm owes him 640 (story A23).
  const nat = (d: CloseoutInput['drafts'][string] = {}) =>
    byId(
      closeoutPlan({
        saleTotalSatang: 0,
        ownerShareSatang: 0,
        workers: [worker({ id: 'w', shareSatang: 525000, balanceSatang: 835000, owedBackSatang: 64000 })],
        drafts: { w: d },
        defaultRoute: () => 'transfer-with-owner',
        rounding: 'none',
      }),
      'w',
    );

  it('full: netting 640 on top of the deduction (5,250 → 5,890)', () => {
    expect(netDraft(nat(), 64000)).toEqual({ nettingSatang: 64000, totalSatang: 589000 });
  });
  it('partial: 300 of the 640', () => {
    expect(netDraft(nat(), 30000)).toEqual({ nettingSatang: 30000, totalSatang: 555000 });
  });
  it('changing it moves only the netting part of the deduction', () => {
    expect(netDraft(nat({ nettingSatang: 64000, totalSatang: 589000 }), 20000)).toEqual({ nettingSatang: 20000, totalSatang: 545000 });
  });
  it('over the ceiling (what the farm owes, capped by the debt) or below 0 is refused', () => {
    expect(netDraft(nat(), 64001)).toBeNull();
    expect(netDraft(nat(), -1)).toBeNull();
  });
  it('0 removes it: the deduction drops by what was netted', () => {
    expect(netDraft(nat({ nettingSatang: 64000, totalSatang: 589000 }), 0)).toEqual({ nettingSatang: 0, totalSatang: 525000 });
  });
  it('never past the whole debt', () => {
    const w = byId(
      closeoutPlan({
        saleTotalSatang: 0,
        ownerShareSatang: 0,
        workers: [worker({ id: 'w', shareSatang: 525000, balanceSatang: 550000, owedBackSatang: 64000 })],
        drafts: {},
        defaultRoute: () => 'transfer-with-owner',
        rounding: 'none',
      }),
      'w',
    );
    expect(netDraft(w, 64000)).toEqual({ nettingSatang: 64000, totalSatang: 550000 });
  });
});

describe('cash step (CO-19)', () => {
  it('not needed with no deduction anywhere and no fraction', () => {
    const p = closeoutPlan({
      saleTotalSatang: 3000000,
      ownerShareSatang: 1000000,
      workers: [worker({ id: 'a', shareSatang: 1000000 }), worker({ id: 'b', shareSatang: 1000000, balanceSatang: 5000 })],
      drafts: { b: { totalSatang: 0 } },
      defaultRoute: () => 'transfer-with-owner',
      rounding: 'worker',
    });
    expect(p.hasFraction).toBe(false);
    expect(p.cashStepNeeded).toBe(false);
  });
  it('needed for a fraction alone, or a deduction alone', () => {
    const frac = closeoutPlan({
      saleTotalSatang: 2000050,
      ownerShareSatang: 1000000,
      workers: [worker({ id: 'a', shareSatang: 1000050 })],
      drafts: {},
      defaultRoute: () => 'transfer-with-owner',
      rounding: 'none',
    });
    expect([frac.hasFraction, frac.cashStepNeeded]).toEqual([true, true]);
    const ded = closeoutPlan({
      saleTotalSatang: 2000000,
      ownerShareSatang: 1000000,
      workers: [worker({ id: 'a', shareSatang: 1000000, balanceSatang: 5000 })],
      drafts: {},
      defaultRoute: () => 'transfer-with-owner',
      rounding: 'none',
    });
    expect([ded.hasFraction, ded.cashStepNeeded]).toEqual([false, true]);
  });
});

// ── sources sheet ───────────────────────────────────────────────────────────

describe('sourcesSheet (CO-9, D-85)', () => {
  it('① sums to the sale, ② and ③ sum to 0, paid = sale', () => {
    const p = closeoutPlan(storyInput());
    const s = sourcesSheet(p, 2887500, 1443750);
    expect(s.shares.lines.reduce((a, l) => a + l.satang, 0) + s.shares.ownerSatang).toBe(2887500);
    expect(s.shares.ok).toBe(true);
    expect(s.debt.lines.reduce((a, l) => a + l.satang, 0)).toBe(0);
    expect(s.debt.ok).toBe(true);
    expect(s.rounding.lines.reduce((a, l) => a + l.satang, 0)).toBe(0);
    expect(s.rounding.lines).toContainEqual(expect.objectContaining({ id: DAENG.id, satang: 50 }));
    expect(s.rounding.lines).toContainEqual(expect.objectContaining({ id: 'owner', satang: -50 }));
    expect(s.paid.lines.reduce((a, l) => a + l.satang, 0)).toBe(2887500);
    expect(s.paid.lines).toContainEqual(expect.objectContaining({ kind: 'transfer', satang: 2293700 }));
    expect(s.paid.ok).toBe(true);
  });

  it('netting shows as a ↗ pair and ② still sums to 0; buyer-split shows as repay-cash', () => {
    const p = closeoutPlan(
      storyInput({
        workers: [
          worker({
            id: NAT.id,
            name: 'นัด',
            shareSatang: 525000,
            balanceSatang: 835000,
            owedBackSatang: 64000,
          }),
          worker({ id: DAENG.id, name: 'แดง', shareSatang: 918750 }),
        ],
        drafts: { [NAT.id]: { nettingSatang: 64000 } },
        defaultRoute: () => 'buyer-split',
      }),
    );
    const s = sourcesSheet(p, 2887500, 1443750);
    expect(s.debt.lines.filter((l) => l.way === 'out')).toEqual([
      expect.objectContaining({ id: `${NAT.id}-net`, satang: 64000 }),
      expect.objectContaining({ id: `farm-net-${NAT.id}`, satang: -64000 }),
    ]);
    expect(s.debt.lines.reduce((a, l) => a + l.satang, 0)).toBe(0);
    expect(s.debt.ok).toBe(true);
    expect(s.paid.lines).toContainEqual(
      expect.objectContaining({
        kind: 'repay-cash',
        id: `${NAT.id}-repay`,
        satang: 525000,
      }),
    );
    expect(s.paid.ok).toBe(true);
  });

  it('② as A8: one ↘ row per tapper, then ONE farm row "สวนรับคืนหนี้" with the sum; down = received', () => {
    const s = sourcesSheet(closeoutPlan(storyInput()), 2887500, 1443750);
    expect(s.debt.lines).toEqual([
      { id: `${DAENG.id}-pay`, party: 'worker', name: 'แดง', way: 'in', satang: -325000 },
      { id: `${NAT.id}-pay`, party: 'worker', name: 'นัด', way: 'in', satang: -525000 },
      { id: 'farm-recv', party: 'farm', name: '', way: 'in', satang: 850000 },
    ]);
    expect(s.debt).toMatchObject({ downSatang: 850000, receivedSatang: 850000, nettedSatang: 0, ok: true });
  });

  it('② with netting as A25: tapper ↗ +640, farm ↘ receives all (with netting), farm ↗ −640; Σ 0', () => {
    const p = closeoutPlan(storyInput({ workers: storyInput().workers.map((w) => (w.id === NAT.id ? { ...w, owedBackSatang: 64000 } : w)), drafts: { [NAT.id]: { nettingSatang: 64000, totalSatang: 589000 } } }));
    const s = sourcesSheet(p, 2887500, 1443750);
    expect(s.debt.lines).toEqual([
      { id: `${DAENG.id}-pay`, party: 'worker', name: 'แดง', way: 'in', satang: -325000 },
      { id: `${NAT.id}-pay`, party: 'worker', name: 'นัด', way: 'in', satang: -589000 },
      { id: `${NAT.id}-net`, party: 'worker', name: 'นัด', way: 'out', satang: 64000 },
      { id: 'farm-recv', party: 'farm', name: '', way: 'in', satang: 914000 },
      { id: `farm-net-${NAT.id}`, party: 'farm', name: 'นัด', way: 'out', satang: -64000 },
    ]);
    expect(s.debt).toMatchObject({ downSatang: 914000, receivedSatang: 850000, nettedSatang: 64000, ok: true });
  });

  it('③ names the farm line as the farm; paid tells the transfer apart: share − rounding + repay (A8)', () => {
    const s = sourcesSheet(closeoutPlan(storyInput()), 2887500, 1443750);
    expect(s.rounding.lines).toEqual([
      { id: DAENG.id, party: 'worker', name: 'แดง', satang: 50 },
      { id: 'owner', party: 'farm', name: '', satang: -50 },
    ]);
    expect(s.paid.transfer).toEqual({ ownerShareSatang: 1443750, roundSatang: -50, repaySatang: 850000 });
  });

  it('a pile that does not add up shows ✗', () => {
    const p = closeoutPlan(storyInput());
    expect(sourcesSheet(p, 2887501, 1443750).shares.ok).toBe(false);
    expect(sourcesSheet(p, 2887501, 1443750).paid.ok).toBe(false);
    // Over the cap: cash is held at 0, so the debt pile no longer balances.
    const over = closeoutPlan(storyInput({ drafts: { [NAT.id]: { totalSatang: 600000 } } }));
    expect(over.anyInvalid).toBe(true);
    expect(over.tally.ok).toBe(false);
    expect(sourcesSheet(over, 2887500, 1443750).debt.ok).toBe(false);
  });
});

// ── CO-24 ───────────────────────────────────────────────────────────────────

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const expand = (g: readonly { satang: number; count: number }[]) => g.flatMap((x) => Array<number>(x.count).fill(x.satang));
function afterBreak(pile: number, broken: number, into: readonly { satang: number; count: number }[]) {
  const notes = cashNotes(pile);
  notes.splice(notes.indexOf(broken), 1);
  return [...notes, ...expand(into)].sort((a, b) => b - a);
}

describe('breakPlan (CO-24)', () => {
  it('pile 9,187.50 take 3,250 → break ฿1,000 into ฿500 ×1 · ฿100 ×4 · ฿50 ×2', () => {
    const b = breakPlan(918750, 325000)!;
    expect(b).not.toBeNull();
    expect(b.broken).toBe(100000);
    expect(b.into).toEqual([
      { satang: 50000, count: 1 },
      { satang: 10000, count: 4 },
      { satang: 5000, count: 2 },
    ]);
    expect(sum(expand(b.into))).toBe(b.broken);
    expect(b.pile[0]).toEqual({ satang: 100000, count: 9 });
    expect(sum(expand(b.pile))).toBe(918750);
    expect(b.smallSatang).toBe(18750);
    expect(b.shortSatang).toBe(6250);
    expect(sum(expand(b.take))).toBe(325000);
    const after = afterBreak(918750, b.broken, b.into);
    expect(liftableNotes(after, 325000)).not.toBeNull();
  });

  it('null when pickNotes already works, take ≤ 0, or take > pile', () => {
    expect(breakPlan(918750, 300000)).toBeNull();
    expect(breakPlan(918750, 918750)).toBeNull();
    expect(breakPlan(918750, 0)).toBeNull();
    expect(breakPlan(918750, -100)).toBeNull();
    expect(breakPlan(918750, 918800)).toBeNull();
  });

  it('property: whenever needsChange and take ≤ pile, a plan exists and take is liftable after', () => {
    let seen = 0;
    let rnd = 12345;
    const next = () => {
      rnd = (rnd * 1103515245 + 12345) % 2147483648;
      return rnd;
    };
    for (let i = 0; i < 1500; i += 1) {
      const pile = (next() % 2000000) + 100 + (i % 3 === 0 ? 50 : 0);
      // Whole baht, or the pile's own satang coin (no satang note can be made by breaking).
      const takeBaht = (next() % Math.floor(pile / 100)) * 100;
      const take = i % 5 === 0 && pile % 100 ? takeBaht + (pile % 100) : takeBaht;
      if (take > pile || !needsChange(pile, take)) continue;
      seen += 1;
      const b = breakPlan(pile, take);
      expect(b, `pile ${pile} take ${take}`).not.toBeNull();
      expect(sum(expand(b!.into))).toBe(b!.broken);
      expect(cashNotes(pile)).toContain(b!.broken);
      expect(b!.into.every((x) => x.satang < b!.broken)).toBe(true);
      expect(liftableNotes(afterBreak(pile, b!.broken, b!.into), take), `pile ${pile} take ${take}`).not.toBeNull();
      expect(sum(expand(b!.take))).toBe(take);
    }
    expect(seen).toBeGreaterThan(200);
  }, 60000);

  it('liftableNotes is an exact subset over the explicit list', () => {
    expect(liftableNotes([100000, 50000, 10000], 60000)).toEqual([50000, 10000]);
    expect(liftableNotes([100000, 50000], 60000)).toBeNull();
    expect(liftableNotes([100000], 0)).toEqual([]);
    // Agrees with pickNotes on an unbroken pile.
    for (const [pile, take] of [
      [918750, 300000],
      [918750, 325000],
      [12345, 345],
    ] as const)
      expect(liftableNotes(cashNotes(pile), take) === null).toBe(pickNotes(pile, take) === null);
  });
});

describe('groupNotes', () => {
  it('groups largest first', () => {
    expect(groupNotes([100000, 100000, 500, 100000, 50])).toEqual([
      { satang: 100000, count: 3 },
      { satang: 500, count: 1 },
      { satang: 50, count: 1 },
    ]);
    expect(groupNotes([])).toEqual([]);
  });
});

// ── confirm gate ────────────────────────────────────────────────────────────

describe('confirmGate (CO-17, CO-26, CO-9)', () => {
  const okPlan = (() => {
    try {
      return closeoutPlan(storyInput());
    } catch {
      return null as unknown as CloseoutPlan;
    }
  })();
  const base = {
    debtors: [
      { id: 'a', name: 'แดง' },
      { id: 'b', name: 'นัด' },
    ],
    debtChecked: new Set(['a', 'b']),
    debtAnswered: false,
    owed: [{ id: 'b' }],
    owedChecked: new Set(['b']),
    owedAnswered: false,
    plan: okPlan,
  };

  it('ready when everything is done', () => expect(confirmGate(base)).toEqual({ kind: 'ready' }));
  it('D-61: a recorded deduction above the cap is not a lock of its own — the plan is invalid until fixed, then ready', () => {
    const rec = { totalSatang: 950000, nettingSatang: 0, route: 'cash-from-share' as const };
    const overIn = storyInput();
    const workers = overIn.workers.map((w) => (w.id === DAENG.id ? { ...w, recorded: rec } : w));
    const stuck = closeoutPlan({ ...overIn, workers });
    expect(byId(stuck, DAENG.id).totalSatang).toBe(950000);
    expect(confirmGate({ ...base, plan: stuck }).kind).toBe('invalid');
    // The cards still come first.
    expect(confirmGate({ ...base, plan: stuck, debtChecked: new Set() }).kind).toBe('check-debt');
    const fixed = closeoutPlan({ ...overIn, workers, drafts: { [DAENG.id]: { totalSatang: 325000 } } });
    expect(confirmGate({ ...base, plan: fixed }).kind).toBe('ready');
  });
  it('check-debt names the unchecked workers', () =>
    expect(confirmGate({ ...base, debtChecked: new Set(['a']) })).toEqual({
      kind: 'check-debt',
      names: ['นัด'],
    }));
  it('answer-debt when no debtors and not answered', () => {
    expect(confirmGate({ ...base, debtors: [] }).kind).toBe('answer-debt');
    expect(confirmGate({ ...base, debtors: [], debtAnswered: true }).kind).toBe('ready');
  });
  it('check-owed / answer-owed', () => {
    expect(confirmGate({ ...base, owedChecked: new Set() }).kind).toBe('check-owed');
    expect(confirmGate({ ...base, owed: [] }).kind).toBe('answer-owed');
    expect(confirmGate({ ...base, owed: [], owedAnswered: true }).kind).toBe('ready');
  });
  it('both pending → check-both / answer-both; one check + one answer → check-both', () => {
    expect(confirmGate({ ...base, debtChecked: new Set(), owedChecked: new Set() }).kind).toBe('check-both');
    expect(confirmGate({ ...base, debtors: [], owed: [] }).kind).toBe('answer-both');
    expect(confirmGate({ ...base, debtors: [], owedChecked: new Set() }).kind).toBe('check-both');
    expect(confirmGate({ ...base, debtChecked: new Set(), owed: [] }).kind).toBe('check-both');
  });
  it('then invalid, then tally', () => {
    const bad = closeoutPlan(storyInput({ drafts: { [NAT.id]: { totalSatang: 600000 } } }));
    expect(confirmGate({ ...base, plan: bad }).kind).toBe('invalid');
    const off = {
      ...okPlan,
      tally: { ok: false, diffSatang: -1, sumSatang: 2887499 },
    };
    expect(confirmGate({ ...base, plan: off }).kind).toBe('tally');
  });
  it('the cash step is not a gate (A3): both cards checked → ready without opening it', () => {
    // `plan.cashStepNeeded` is true here (story example: deductions and a fraction) and the step was never opened.
    expect(okPlan.cashStepNeeded).toBe(true);
    expect(confirmGate(base).kind).toBe('ready');
  });
});

// ── confirm writes ──────────────────────────────────────────────────────────

describe('confirmWrites (idempotent, existing event shapes)', () => {
  const owed: Reimbursement[] = [
    {
      expenseId: 'e-1',
      to: NAT,
      originalSatang: 40000,
      repaidSatang: 0,
      remainingSatang: 40000,
      date: '2026-10-01',
      status: 'owed',
      repayments: [],
    },
    {
      expenseId: 'e-2',
      to: NAT,
      originalSatang: 24000,
      repaidSatang: 0,
      remainingSatang: 24000,
      date: '2026-10-02',
      status: 'owed',
      repayments: [],
    },
  ];
  const planFor = (w: Partial<CloseoutWorkerInput>, d: CloseoutInput['drafts'][string] = {}): CloseoutWorker =>
    byId(
      closeoutPlan({
        saleTotalSatang: 0,
        ownerShareSatang: 0,
        workers: [
          worker({
            id: NAT.id,
            name: 'นัด',
            shareSatang: 525000,
            balanceSatang: 835000,
            ...w,
          }),
        ],
        drafts: { [NAT.id]: d },
        defaultRoute: () => 'buyer-split',
        rounding: 'none',
      }),
      NAT.id,
    );
  const run = (plan: CloseoutWorker, recorded: RecordedLine[] = []) =>
    confirmWrites({
      saleId: SALE,
      date: '2026-10-31',
      worker: NAT,
      farm: FARM,
      plan,
      recorded,
      owed,
      newId: counter(),
    });
  const line = (id: string, method: DebtPaymentMethod, amountSatang: number, more: Partial<RecordedLine> = {}): RecordedLine => ({
    id,
    headEventId: `${id}-h`,
    method,
    amountSatang,
    ...more,
  });

  it('first write: one route line with a fresh id from the factory (random on device) and the existing payload shape', () => {
    const r = run(planFor({}));
    expect(r).toEqual({
      ok: true,
      writes: [
        {
          op: 'write',
          id: 'dpay-1',
          base: null,
          payload: {
            t: 'debt_payment_recorded',
            fields: {
              worker: NAT,
              creditor: FARM,
              amountSatang: 525000,
              date: '2026-10-31',
              note: '',
              method: 'buyer-split',
              saleId: SALE,
            },
          },
        },
      ],
    });
  });

  it('nothing when the recorded lines already match (a re-run writes nothing)', () => {
    const plan = planFor({}, { totalSatang: 300000 });
    expect(run(plan, [line('x', 'buyer-split', 300000)])).toEqual({
      ok: true,
      writes: [],
    });
    // Same total but split over two lines of the same route still matches.
    expect(run(plan, [line('x', 'buyer-split', 100000), line('y', 'buyer-split', 200000)])).toEqual({ ok: true, writes: [] });
    // No deduction and nothing recorded.
    expect(run(planFor({}, { totalSatang: 0 }))).toEqual({
      ok: true,
      writes: [],
    });
  });

  it('a change voids the old lines first (repayment before its debt payment), then writes a new line under a fresh id', () => {
    const plan = planFor({ owedBackSatang: 64000 }, { totalSatang: 400000 });
    const r = run(plan, [
      line('net1', 'netting', 64000, {
        repaymentId: 'rep1',
        repaymentHead: 'rep1-h',
      }),
      line('r1', 'transfer-with-owner', 100000),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.writes.map((w) => [w.op, w.id, w.base])).toEqual([
      ['void-repayment', 'rep1', 'rep1-h'],
      ['void-payment', 'net1', 'net1-h'],
      ['void-payment', 'r1', 'r1-h'],
      ['write', 'dpay-1', null],
    ]);
  });

  it('netting: debt payment, then repayment (nettingPayloads), then the route line', () => {
    const plan = planFor({ owedBackSatang: 64000 }, { nettingSatang: 64000 });
    const r = run(plan);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const repId = 'rep-2';
    const expected = nettingPayloads({
      worker: NAT,
      farm: FARM,
      owed,
      amountSatang: 64000,
      saleId: SALE,
      date: '2026-10-31',
      repaymentId: repId,
    });
    if (!expected.ok) throw new Error('fixture');
    expect(r.writes).toEqual([
      {
        op: 'write',
        id: 'dpay-1',
        base: null,
        payload: expected.debtPayment,
      },
      { op: 'write', id: repId, base: null, payload: expected.repayment },
      {
        op: 'write',
        id: 'dpay-3',
        base: null,
        payload: {
          t: 'debt_payment_recorded',
          fields: {
            worker: NAT,
            creditor: FARM,
            amountSatang: 525000,
            date: '2026-10-31',
            note: '',
            method: 'buyer-split',
            saleId: SALE,
          },
        },
      },
    ]);
  });

  it('total 0 with recorded lines → only voids', () => {
    const r = run(planFor({}, { totalSatang: 0 }), [line('r1', 'cash-from-share', 100000)]);
    expect(r).toEqual({
      ok: true,
      writes: [{ op: 'void-payment', id: 'r1', base: 'r1-h' }],
    });
  });

  it('netting not placeable → { ok: false } and nothing else', () => {
    const plan = planFor({ owedBackSatang: 64000 }, { nettingSatang: 64000 });
    expect(
      confirmWrites({
        saleId: SALE,
        date: '2026-10-31',
        worker: NAT,
        farm: FARM,
        plan,
        recorded: [],
        owed: [],
        newId: counter(),
      }),
    ).toEqual({ ok: false });
  });

  it('an invalid plan writes nothing', () => {
    expect(run(planFor({}, { totalSatang: 999999 }))).toEqual({ ok: false });
  });

  it('every id comes from the factory, none is built from the sale or the worker (two devices never share one)', () => {
    const plan = planFor({ owedBackSatang: 64000 }, { nettingSatang: 64000 });
    const r = run(plan);
    expect(r.ok && r.writes.map((w) => w.id)).toEqual(['dpay-1', 'rep-2', 'dpay-3']);
    expect(r.ok && r.writes.every((w) => !w.id.includes(SALE) && !w.id.includes(NAT.id))).toBe(true);
  });
});

// ── two devices confirm the same sale offline (owner 2026-11-01: random ids, both count) ──

describe('two devices confirm the same sale offline (D-30, D-61): nothing is lost silently', () => {
  const W: Payer = NAT;
  const owedTo: Reimbursement[] = [{ expenseId: 'x1', to: W, originalSatang: 64000, repaidSatang: 0, remainingSatang: 64000, date: '2026-10-01', status: 'owed', repayments: [] } as unknown as Reimbursement];
  let n = 0;
  const ev = (dev: string, targetId: string, payload: FinancePayload): FinanceEvent => ({
    id: `${dev}-${String(++n).padStart(4, '0')}`,
    groupId: 'g',
    deviceSeq: n,
    ts: n,
    actor: { userId: 'u', deviceId: dev },
    source: 'app',
    targetId,
    baseEventId: null,
    payload,
  } as FinanceEvent);
  const seed = (): FinanceEvent[] => [
    ev('z', 'd1', { t: 'debt_added', fields: { worker: W, kind: 'other', amountSatang: 1000000, date: '2026-10-01', note: '', lender: null, fertilizer: null, carriedForward: false } } as FinancePayload),
    ev('z', 'x1', { t: 'expense_created', fields: { amountSatang: 64000, date: '2026-10-01', stage: 'actual', categoryId: null, propertyId: null, item: 'ปุ๋ย', note: '', payer: W } } as FinancePayload),
  ];
  /** One device's confirm, from nothing recorded (it has not seen the other device's lines). */
  const confirmOn = (dev: string, draft: { nettingSatang?: number; totalSatang?: number }) => {
    const p = closeoutPlan({
      saleTotalSatang: 1000000,
      ownerShareSatang: 500000,
      workers: [{ id: W.id, name: W.name, shareSatang: 500000, balanceSatang: 1000000, planPerSaleSatang: null, owedBackSatang: 64000, recorded: null }],
      drafts: { [W.id]: draft },
      defaultRoute: () => 'transfer-with-owner',
      rounding: 'none',
    });
    let k = 0;
    const r = confirmWrites({ saleId: 'S', date: '2026-10-31', worker: W, farm: FARM, plan: p.workers[0], recorded: [], owed: owedTo, newId: (prefix) => `${prefix}${dev}${++k}` });
    if (!r.ok) throw new Error('fixture');
    return r.writes.flatMap((x) => (x.op === 'write' ? [ev(dev, x.id, x.payload)] : []));
  };
  const counted = (events: readonly FinanceEvent[]) => (projectDebts(events).get(W.id)?.payments ?? []).filter((p) => p.saleId === 'S' && !p.deleted && p.counts);

  it('both devices\' deductions count: the sum is over the share, so the D-61 flag is up for the owner to fix', () => {
    const a = confirmOn('A', { totalSatang: 400000 });
    const b = confirmOn('B', { totalSatang: 300000 });
    const lines = counted([...seed(), ...a, ...b]);
    expect(lines.map((l) => l.amountSatang).sort()).toEqual([300000, 400000]);
    const net = lines.filter((l) => l.method === 'netting').reduce((x, l) => x + l.amountSatang, 0);
    const total = lines.reduce((x, l) => x + l.amountSatang, 0);
    expect(overDeducted(total, 500000, net)).toBe(true);
  });

  it('netting from two devices, written interleaved: each netting debt payment counts with its OWN repayment of the same amount', () => {
    const a = confirmOn('A', { nettingSatang: 64000 });
    const b = confirmOn('B', { nettingSatang: 30000, totalSatang: 200000 });
    // interleaved as two phones syncing would land them: A net, B net, B rep, A rep, B route, A route
    const events = [...seed(), a[0], b[0], b[1], a[1], b[2], a[2]];
    const lines = counted(events);
    const nets = lines.filter((l) => l.method === 'netting');
    expect(nets.map((l) => l.amountSatang).sort()).toEqual([30000, 64000]);
    const reps = projectFinance(events).repayments.filter((r) => !r.deleted);
    for (const l of nets) {
      const rep = reps.find((r) => r.id === l.repaymentId);
      expect(rep?.amountSatang).toBe(l.amountSatang);
    }
    // every route line is there too: A's proposal (share + netting 564,000 − 64,000 = 500,000 by route) and B's 200,000 − 30,000
    expect(lines.filter((l) => l.method !== 'netting').map((l) => l.amountSatang).sort()).toEqual([170000, 500000]);
  });
});

// ── CO-25 ───────────────────────────────────────────────────────────────────

describe('pendingRepays (CO-25)', () => {
  let plan: CloseoutPlan;
  beforeAll(() => {
    plan = closeoutPlan(storyInput({ drafts: { [NAT.id]: { route: 'buyer-split' } } }));
  });
  it('transfer route pending while the owner transfer is not ticked; cash routes until debt cash is ticked', () => {
    expect(pendingRepays(plan, { owner: false, debtCash: () => false })).toEqual([
      { workerId: DAENG.id, name: 'แดง', satang: 325000, how: 'transfer' },
      { workerId: NAT.id, name: 'นัด', satang: 525000, how: 'cash' },
    ]);
    expect(pendingRepays(plan, { owner: true, debtCash: (id) => id === NAT.id })).toEqual([]);
    expect(pendingRepays(plan, { owner: true, debtCash: () => false }).map((x) => x.workerId)).toEqual([NAT.id]);
  });
  it('cash-from-share is a cash repayment too; no deduction → nothing pending', () => {
    const p = closeoutPlan(
      storyInput({
        drafts: {
          [DAENG.id]: { route: 'cash-from-share' },
          [NAT.id]: { totalSatang: 0 },
        },
      }),
    );
    expect(pendingRepays(p, { owner: false, debtCash: () => false })).toEqual([{ workerId: DAENG.id, name: 'แดง', satang: 325000, how: 'cash' }]);
  });
});

// ── B1 / N2 / N3 / N5 (re-review 2, owner 2026-11-01 (A)) ───────────────────

/**
 * Two phones confirm the same sale offline: both sets of lines count (random
 * ids, owner (A)), and the doubled deduction must never be silent — even when
 * the sum stays inside the share (S1). Built from the log the way the app is
 * (`closeoutInputs`, the same function use-closeout calls), with the payment
 * page's plan (drafts {}) checked through `payBlocks`.
 */
describe('a double deduction from two devices is flagged, locks the payment, and the summary fixes it (B1, D-30, D-61)', () => {
  const W: Payer = NAT;
  const S = 'S';
  let n = 0;
  const ev = (dev: string, targetId: string, base: string | null, payload: FinancePayload): FinanceEvent =>
    ({ id: `${String(++n).padStart(5, '0')}-${dev}`, groupId: 'g', deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: dev }, source: 'app', targetId, baseEventId: base, payload }) as FinanceEvent;
  const seed = (debt: number, owed = 0, plan: number | null = null): FinanceEvent[] => [
    ev('z', 'd1', null, { t: 'debt_added', fields: { worker: W, kind: 'other', amountSatang: debt, date: '2026-10-01', note: 'x', lender: null, fertilizer: null, carriedForward: false } } as FinancePayload),
    ...(owed ? [ev('z', 'x1', null, { t: 'expense_created', fields: { amountSatang: owed, date: '2026-10-01', stage: 'actual', categoryId: null, propertyId: null, item: 'ปุ๋ย', note: '', payer: W } } as FinancePayload)] : []),
    ...(plan !== null ? [ev('z', 'pl', null, { t: 'debt_plan_set', worker: W, perSaleSatang: plan } as unknown as FinancePayload)] : []),
  ];
  const planOf = (inputs: readonly CloseoutWorkerInput[], share: number, drafts: CloseoutInput['drafts']) =>
    closeoutPlan({ saleTotalSatang: share + 500000, ownerShareSatang: 500000, workers: inputs, drafts, defaultRoute: () => 'transfer-with-owner', rounding: 'none' });
  const derive = (events: FinanceEvent[], share: number, drafts: CloseoutInput['drafts'] = {}, own: string | null = null) => {
    const ins = closeoutInputs({ saleId: S, tappers: [{ id: W.id, name: W.name, shareSatang: share }], accounts: projectDebts(events), finance: projectFinance(events), events, ownDeviceId: own });
    const input = ins.inputs[0];
    const plan = planOf(ins.inputs, share, drafts);
    const gate = confirmGate({ debtors: input.balanceSatang > 0 ? [W] : [], debtChecked: new Set([W.id]), debtAnswered: true, owed: input.owedBackSatang > 0 ? [W] : [], owedChecked: new Set([W.id]), owedAnswered: true, plan });
    return { ins, input, plan, w: plan.workers[0], gate, blocks: payBlocks(planOf(ins.inputs, share, {})) };
  };
  let k = 0;
  /** One device's ยืนยันยอด on the log it has seen; returns the events it writes. */
  const confirmOn = (dev: string, events: FinanceEvent[], share: number, drafts: CloseoutInput['drafts'] = {}): FinanceEvent[] => {
    const d = derive(events, share, drafts);
    if (d.gate.kind !== 'ready') throw new Error(`gate ${d.gate.kind}`);
    const r = confirmWrites({ saleId: S, date: '2026-10-31', worker: W, farm: FARM, plan: d.w, recorded: d.ins.recordedLines(W.id), owed: d.ins.owedOf(W.id), newId: (p) => `${p}${dev}${++k}` });
    if (!r.ok) throw new Error('refused');
    return r.writes.map((x) =>
      x.op === 'write'
        ? ev(dev, x.id, null, x.payload)
        : ev(dev, x.id, x.base, (x.op === 'void-repayment' ? { t: 'repayment_changed', patch: { deleted: true } } : { t: 'debt_payment_changed', patch: { deleted: true } }) as FinancePayload),
    );
  };
  const both = (base: FinanceEvent[], share: number, drafts: CloseoutInput['drafts'] = {}) => [...base, ...confirmOn('A', base, share, drafts), ...confirmOn('B', base, share, drafts)];

  it('S1 · plan 1,000 a sale, share 5,000: both devices deduct 1,000 → 2,000 inside the share, still flagged; summary gate and payment page locked', () => {
    const d = derive(both(seed(1000000, 0, 100000), 500000), 500000);
    expect(d.input.devices).toBe(2);
    expect(d.w.totalSatang).toBe(200000);
    expect(d.w.invalid).toBe(false);
    expect(d.w.doubled).toBe(true);
    expect(d.w.doubleOpen).toBe(true);
    expect(d.gate).toEqual({ kind: 'double', names: ['นัด'] });
    expect(d.blocks).toEqual([{ id: W.id, name: 'นัด', why: 'double', devices: 2 }]);
  });

  it('owner 2026-11-01 · a double offers ONE device\'s amount (the sheet\'s proposal, ✓ unchanged) and the sum apart ("หักทั้งสอง")', () => {
    const d = derive(both(seed(1000000, 0, 100000), 500000), 500000);
    expect(d.input.oneDevice).toEqual({ totalSatang: 100000, nettingSatang: 0 });
    expect(d.w.doublePick).toEqual({ one: { totalSatang: 100000, nettingSatang: 0 }, both: { totalSatang: 200000, nettingSatang: 0 } });
    // the sheet's ✓ on the one amount: the double is fixed, one 1,000 line by one device
    const one = { [W.id]: { ...d.w.doublePick!.one, doubleChoice: 'one' as const } };
    expect(derive(both(seed(1000000, 0, 100000), 500000), 500000, one).gate.kind).toBe('ready');
    const all = both(seed(1000000, 0, 100000), 500000);
    const after = derive([...all, ...confirmOn('A', all, 500000, one)], 500000);
    expect(after.ins.recordedLines(W.id).map((l) => [l.amountSatang, l.deviceId])).toEqual([[100000, 'A']]);
    expect([after.w.doubled, after.w.doublePick, after.blocks]).toEqual([false, null, []]);
    // "หักทั้งสอง": the sum, still one set from one device
    const twice = derive([...all, ...confirmOn('B', all, 500000, { [W.id]: { ...d.w.doublePick!.both, doubleChoice: 'both' } })], 500000);
    expect(twice.ins.recordedLines(W.id).map((l) => [l.amountSatang, l.deviceId])).toEqual([[200000, 'B']]);
    expect(twice.w.doubled).toBe(false);
  });

  it('owner 2026-11-01 · the two devices recorded different amounts: the one amount is the plan\'s normal proposal', () => {
    const base = seed(1000000, 0, 100000);
    const all = [...base, ...confirmOn('A', base, 500000), ...confirmOn('B', base, 500000, { [W.id]: { totalSatang: 300000 } })];
    const d = derive(all, 500000);
    expect(d.w.doubled).toBe(true);
    expect(d.input.oneDevice).toBeNull();
    expect(d.w.doublePick).toEqual({ one: { totalSatang: 100000, nettingSatang: 0 }, both: { totalSatang: 400000, nettingSatang: 0 } });
  });

  it('owner 2026-11-01 · S3 analog: both net 640 → the one amount nets 640 (valid), the sum nets 1,280', () => {
    const all = both(seed(1000000, 64000), 500000, { [W.id]: { nettingSatang: 64000, totalSatang: 64000 } });
    const d = derive(all, 500000);
    expect(d.w.doublePick).toEqual({ one: { totalSatang: 64000, nettingSatang: 64000 }, both: { totalSatang: 128000, nettingSatang: 128000 } });
    const fixed = derive(all, 500000, { [W.id]: { ...d.w.doublePick!.one, doubleChoice: 'one' } });
    expect([fixed.w.nettingSatang, fixed.w.invalid, fixed.w.doubleOpen, fixed.gate.kind]).toEqual([64000, false, false, 'ready']);
  });

  it('not doubled → no pick', () => {
    const base = seed(1000000, 0, 100000);
    expect(derive([...base, ...confirmOn('A', base, 500000)], 500000).w.doublePick).toBeNull();
    expect(derive(base, 500000).w.doublePick).toBeNull();
  });

  it('S2 · debt 2,000, both deduct it all: 4,000 > the debt; the double flag (not only "invalid") locks the payment page', () => {
    const d = derive(both(seed(200000), 500000), 500000);
    expect(d.w.totalSatang).toBe(400000);
    expect(d.w.problem).toBe('total-range');
    expect(d.gate.kind).toBe('double');
    expect(d.blocks.map((b) => b.why)).toEqual(['double']);
  });

  it('S3 · both net 640 (the farm owes 640): netting 1,280 > owed; flagged double, payment page locked', () => {
    const all = both(seed(1000000, 64000), 500000, { [W.id]: { nettingSatang: 64000, totalSatang: 64000 } });
    expect(projectFinance(all).reimbursements[0].remainingSatang).toBe(-64000);
    const d = derive(all, 500000);
    expect(d.w.problem).toBe('net-range');
    expect(d.gate.kind).toBe('double');
    expect(d.blocks.map((b) => b.why)).toEqual(['double']);
  });

  it('the fix: the owner sets the amount in the deduct sheet and confirms → all old lines void, one set written by one device; nothing locked after', () => {
    const all = both(seed(1000000, 0, 100000), 500000);
    // untouched, confirm stays off (the double is open)
    expect(derive(all, 500000, {}).gate.kind).toBe('double');
    const fix = { [W.id]: { totalSatang: 100000, doubleChoice: 'one' as const } };
    expect(derive(all, 500000, fix).gate.kind).toBe('ready');
    const out = confirmOn('A', all, 500000, fix);
    expect(out.filter((e) => e.payload.t === 'debt_payment_changed')).toHaveLength(2);
    const after = derive([...all, ...out], 500000);
    expect(after.input.devices).toBe(1);
    expect(after.w.doubled).toBe(false);
    expect(after.w.totalSatang).toBe(100000);
    expect(after.blocks).toEqual([]);
    expect(after.gate.kind).toBe('ready');
    // and confirming again writes nothing
    expect(confirmOn('A', [...all, ...out], 500000, {})).toEqual([]);
  });

  it('the fix keeps the doubled sum if the owner says so: still rewritten as one device\'s lines (confirmWrites does not "match" lines from two devices)', () => {
    const all = both(seed(1000000, 0, 100000), 500000);
    const out = confirmOn('B', all, 500000, { [W.id]: { totalSatang: 200000, doubleChoice: 'both' } });
    expect(out.length).toBeGreaterThan(0);
    const after = derive([...all, ...out], 500000);
    expect(after.ins.recordedLines(W.id).map((l) => [l.amountSatang, l.deviceId])).toEqual([[200000, 'B']]);
    expect(after.w.doubled).toBe(false);
  });

  it('S2 and S3 fixed the same way', () => {
    const s2 = both(seed(200000), 500000);
    const s2after = derive([...s2, ...confirmOn('A', s2, 500000, { [W.id]: { totalSatang: 200000, doubleChoice: 'one' } })], 500000);
    expect([s2after.w.totalSatang, s2after.w.invalid, s2after.blocks]).toEqual([200000, false, []]);
    const s3 = both(seed(1000000, 64000), 500000, { [W.id]: { nettingSatang: 64000, totalSatang: 64000 } });
    const s3out = [...s3, ...confirmOn('A', s3, 500000, { [W.id]: { nettingSatang: 64000, totalSatang: 64000, doubleChoice: 'one' } })];
    const s3after = derive(s3out, 500000);
    expect([s3after.w.nettingSatang, s3after.w.invalid, s3after.blocks]).toEqual([64000, false, []]);
    expect(projectFinance(s3out).reimbursements[0].remainingSatang).toBe(0);
  });

  it('S3 · the sheet\'s หักกลบ link fixes the doubled netting: the route part stays, the netting becomes what the farm owes (netDraft from the netting asked for)', () => {
    const all = both(seed(1000000, 64000), 500000, { [W.id]: { nettingSatang: 64000, totalSatang: 64000 } });
    const d = derive(all, 500000);
    expect([d.w.nettingSatang, d.w.typedNettingSatang, d.w.netCapSatang]).toEqual([0, 128000, 64000]);
    expect(netDraft(d.w, 64000)).toEqual({ nettingSatang: 64000, totalSatang: 64000 });
  });

  it('one device confirming, then re-editing, is never a double; a second device editing over synced lines is not either', () => {
    const base = seed(1000000, 0, 100000);
    const a1 = [...base, ...confirmOn('A', base, 500000)];
    const a2 = [...a1, ...confirmOn('A', a1, 500000, { [W.id]: { totalSatang: 300000 } })];
    expect(derive(a2, 500000).w.doubled).toBe(false);
    const b = [...a2, ...confirmOn('B', a2, 500000, { [W.id]: { totalSatang: 250000 } })];
    expect(derive(b, 500000).w.doubled).toBe(false);
    expect(derive(b, 500000).w.totalSatang).toBe(250000);
  });

  it('D-61 over the share (sale edited down) is a payment-page block of its own kind', () => {
    const base = seed(1000000);
    const done = [...base, ...confirmOn('A', base, 500000)];
    expect(derive(done, 300000).blocks).toEqual([{ id: W.id, name: 'นัด', why: 'over', devices: 1 }]);
  });

  it('N2 · the debt deleted after the deduction: the ↘ row stays (hasDebt), the payment page is locked, and setting 0 fixes it', () => {
    const base = seed(100000);
    const done = [...base, ...confirmOn('A', base, 500000)];
    const del = [...done, ev('z', 'd1', base[0].id, { t: 'debt_changed', patch: { deleted: true } } as FinancePayload)];
    const d = derive(del, 500000);
    expect(d.w.hasDebt).toBe(true);
    expect(d.w.invalid).toBe(true);
    expect(d.gate).toMatchObject({ kind: 'invalid', problem: 'total-range' });
    expect(d.blocks).toEqual([{ id: W.id, name: 'นัด', why: 'invalid', devices: 1 }]);
    const fixed = [...del, ...confirmOn('A', del, 500000, { [W.id]: { totalSatang: 0 } })];
    const after = derive(fixed, 500000);
    expect(after.input.recorded).toBeNull();
    expect(after.w.hasDebt).toBe(false);
    expect(after.blocks).toEqual([]);
  });

  it('N5 · the invalid gate says which problem (and the figure the sheet says)', () => {
    const p = (drafts: CloseoutInput['drafts']) => closeoutPlan(storyInput({ drafts, workers: storyInput().workers.map((w) => (w.id === NAT.id ? { ...w, owedBackSatang: 64000 } : w)) }));
    const g = (plan: CloseoutPlan) => confirmGate({ debtors: [], debtChecked: new Set(), debtAnswered: true, owed: [], owedChecked: new Set(), owedAnswered: true, plan });
    expect(g(p({ [NAT.id]: { totalSatang: 600000 } }))).toEqual({ kind: 'invalid', name: 'นัด', problem: 'total-range', capSatang: 525000, netCapSatang: 64000, nettingSatang: 0 });
    expect(g(p({ [NAT.id]: { nettingSatang: 70000 } }))).toMatchObject({ kind: 'invalid', problem: 'net-range', netCapSatang: 64000 });
    expect(g(p({ [NAT.id]: { nettingSatang: 64000, totalSatang: 30000 } }))).toMatchObject({ kind: 'invalid', problem: 'below-netting', nettingSatang: 64000 });
  });

  it('N3 · a check\'s signature moves on another device\'s lines or a new debt, never on this device\'s own confirm (even one stopped part-way)', () => {
    const base = seed(1000000, 64000);
    const sig = (events: FinanceEvent[]) => derive(events, 500000, {}, 'A').ins.sigs;
    const s0 = sig(base);
    const a = confirmOn('A', base, 500000, { [W.id]: { nettingSatang: 64000 } });
    for (let i = 1; i <= a.length; i++) expect(sig([...base, ...a.slice(0, i)])).toEqual(s0);
    const b = confirmOn('B', base, 500000);
    expect(sig([...base, ...a, ...b]).get(`debt:${W.id}`)).not.toBe(s0.get(`debt:${W.id}`));
    const more = [...base, ev('A', 'd2', null, { t: 'debt_added', fields: { worker: W, kind: 'other', amountSatang: 5000, date: '2026-10-02', note: '', lender: null, fertilizer: null, carriedForward: false } } as FinancePayload)];
    expect(sig(more).get(`debt:${W.id}`)).not.toBe(s0.get(`debt:${W.id}`));
  });

  it('N3 · staleChecks: none dropped while a confirm runs; after it, a moved figure drops only that check', () => {
    const sigs = new Map([[`debt:a`, '2'], [`owed:a`, '1'], [`debt:b`, '1']]);
    const seen = { 'debt:a': '1', 'owed:a': '1', 'debt:b': '1' };
    const i = { sigs, seen, debtChecked: ['a', 'b'], owedChecked: ['a'] };
    expect(staleChecks({ ...i, busy: true })).toEqual([]);
    expect(staleChecks({ ...i, busy: false })).toEqual(['debt:a']);
    // a check never tracked (seen missing) is never dropped
    expect(staleChecks({ ...i, seen: {}, busy: false })).toEqual([]);
  });

  // ── review 3 (B1, NB1): only the owner's one/both choice in the deduct sheet clears a double ──

  it('review 3 · B1 Scenario A: S1 + the farm owes 640; the owed sheet\'s "↗ หักกลบ" (netDraft) writes netting into the draft — the gate stays on double', () => {
    const all = both(seed(1000000, 64000, 100000), 500000);
    const d = derive(all, 500000);
    expect([d.w.doubled, d.w.doubleOpen, d.w.netCapSatang]).toEqual([true, true, 64000]);
    const netted = { [W.id]: netDraft(d.w, d.w.netCapSatang)! };
    const after = derive(all, 500000, netted);
    expect(after.w.doubleOpen).toBe(true);
    expect(after.gate.kind).toBe('double');
  });

  it('review 3 · B1 Scenario B: S3 (both net 640); the owed sheet\'s "ไว้ก่อน" (netDraft 0) sets total 0 — the gate stays on double', () => {
    const all = both(seed(1000000, 64000), 500000, { [W.id]: { nettingSatang: 64000, totalSatang: 64000 } });
    const d = derive(all, 500000);
    const held = { [W.id]: netDraft(d.w, 0)! };
    expect(held[W.id]).toEqual({ nettingSatang: 0, totalSatang: 0 });
    const after = derive(all, 500000, held);
    expect(after.w.doubleOpen).toBe(true);
    expect(after.gate.kind).toBe('double');
  });

  it('review 3 · B1: amounts in the draft alone (the sheet opened, keys typed, never ✓) keep the double; doubleChoice one / both clears it', () => {
    const all = both(seed(1000000, 0, 100000), 500000);
    const d = derive(all, 500000);
    expect(derive(all, 500000, { [W.id]: d.w.doublePick!.one }).gate.kind).toBe('double');
    expect(derive(all, 500000, { [W.id]: { totalSatang: 150000 } }).w.doubleOpen).toBe(true);
    const one = derive(all, 500000, { [W.id]: { ...d.w.doublePick!.one, doubleChoice: 'one' } });
    expect([one.w.doubleOpen, one.w.dirty, one.gate.kind]).toEqual([false, true, 'ready']);
    const sum = derive(all, 500000, { [W.id]: { ...d.w.doublePick!.both, doubleChoice: 'both' } });
    expect([sum.w.doubleOpen, sum.w.dirty, sum.w.totalSatang, sum.gate.kind]).toEqual([false, true, 200000, 'ready']);
  });

  it('review 3 · NB1: "หักทั้งสอง" says why the sum cannot be deducted (S2 over the debt, S3 netting over what is owed); S1 is fine', () => {
    expect(derive(both(seed(1000000, 0, 100000), 500000), 500000).w.doubleBothProblem).toBeNull();
    expect(derive(both(seed(200000), 500000), 500000).w.doubleBothProblem).toEqual({ problem: 'total-range', capSatang: 200000 });
    const s3 = both(seed(1000000, 64000), 500000, { [W.id]: { nettingSatang: 64000, totalSatang: 64000 } });
    expect(derive(s3, 500000).w.doubleBothProblem).toMatchObject({ problem: 'net-range' });
    // not doubled → nothing to say
    const base = seed(1000000, 0, 100000);
    expect(derive([...base, ...confirmOn('A', base, 500000)], 500000).w.doubleBothProblem).toBeNull();
  });
});
