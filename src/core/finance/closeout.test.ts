import { beforeAll, describe, expect, it } from 'vitest';

import {
  breakPlan,
  closeoutPlan,
  confirmGate,
  confirmWrites,
  debtPieces,
  groupNotes,
  liftableNotes,
  pendingRepays,
  quickAmounts,
  REPAY_ROUTES,
  ROUNDING_MENU,
  sourcesSheet,
  type CloseoutInput,
  type CloseoutPlan,
  type CloseoutWorker,
  type CloseoutWorkerInput,
  type RecordedLine,
} from './closeout';
import type { Debt, DebtAccount, DebtPayment } from './debts';
import { cashNotes, deductSheet, needsChange, nettingPayloads, pickNotes, roundCash, type RoundingMode } from './deduct';
import type { Reimbursement } from './ledger';
import { roundSettlement } from './rounding';
import { FARM_FUNDS, type DebtKind, type DebtPaymentMethod, type Payer } from './types';

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

// ── CO-22 ───────────────────────────────────────────────────────────────────

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
    expect(s.debt.lines.filter((l) => l.way === 'out')).toEqual([expect.objectContaining({ id: `${NAT.id}-net`, satang: 64000 })]);
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
    cashStepNeeded: true,
    cashStepDone: true,
    plan: okPlan,
    over: false,
  };

  it('ready when everything is done', () => expect(confirmGate(base)).toEqual({ kind: 'ready' }));
  it("'over' comes first", () => expect(confirmGate({ ...base, over: true, debtChecked: new Set() }).kind).toBe('over'));
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
  it('then invalid, then tally, then cash step', () => {
    const bad = closeoutPlan(storyInput({ drafts: { [NAT.id]: { totalSatang: 600000 } } }));
    expect(confirmGate({ ...base, plan: bad, cashStepDone: false }).kind).toBe('invalid');
    const off = {
      ...okPlan,
      tally: { ok: false, diffSatang: -1, sumSatang: 2887499 },
    };
    expect(confirmGate({ ...base, plan: off, cashStepDone: false }).kind).toBe('tally');
    expect(confirmGate({ ...base, cashStepDone: false }).kind).toBe('cash-step');
    expect(confirmGate({ ...base, cashStepNeeded: false, cashStepDone: false }).kind).toBe('ready');
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
  const run = (plan: CloseoutWorker, recorded: RecordedLine[] = [], extra: { knownIds?: readonly string[] } = {}) =>
    confirmWrites({
      saleId: SALE,
      date: '2026-10-31',
      worker: NAT,
      farm: FARM,
      plan,
      recorded,
      owed,
      ...extra,
    });
  const line = (id: string, method: DebtPaymentMethod, amountSatang: number, more: Partial<RecordedLine> = {}): RecordedLine => ({
    id,
    headEventId: `${id}-h`,
    method,
    amountSatang,
    ...more,
  });

  it('first write: one route line with the fixed id and the existing payload shape', () => {
    const r = run(planFor({}));
    expect(r).toEqual({
      ok: true,
      writes: [
        {
          op: 'write',
          id: `dpay-${SALE}-${NAT.id}-0`,
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

  it('a change voids the old lines first (repayment before its debt payment), then writes gen = lines recorded', () => {
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
      ['write', `dpay-${SALE}-${NAT.id}-2`, null],
    ]);
  });

  it('netting: debt payment, then repayment (nettingPayloads), then the route line', () => {
    const plan = planFor({ owedBackSatang: 64000 }, { nettingSatang: 64000 });
    const r = run(plan);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const repId = `rep-${SALE}-${NAT.id}-0`;
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
        id: `dpay-${SALE}-${NAT.id}-0-net`,
        base: null,
        payload: expected.debtPayment,
      },
      { op: 'write', id: repId, base: null, payload: expected.repayment },
      {
        op: 'write',
        id: `dpay-${SALE}-${NAT.id}-0`,
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
      }),
    ).toEqual({ ok: false });
  });

  it('an invalid plan writes nothing', () => {
    expect(run(planFor({}, { totalSatang: 999999 }))).toEqual({ ok: false });
  });

  it('never reuses an id this sale already used (deleted lines passed as knownIds)', () => {
    const plan = planFor({}, { totalSatang: 300000 });
    const r = run(plan, [], {
      knownIds: [`dpay-${SALE}-${NAT.id}-0`, `dpay-${SALE}-${NAT.id}-1`],
    });
    expect(r.ok && r.writes.map((w) => w.id)).toEqual([`dpay-${SALE}-${NAT.id}-2`]);
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
