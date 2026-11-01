/**
 * E05-S11 · a seeded fuzz over the close-out plan (from the independent
 * review, kept as a core test): random sales of 1–4 tappers, random shares,
 * debts, plans, owed money, routes and rounding; typed totals and partial
 * netting applied the way the screens do (`netDraft`). For every valid plan:
 *
 * - the tally and the three checks of D-85 hold (Σ = sale to the satang);
 * - the lines `confirmWrites` would record, put through the OLD formulas
 *   (`workerCash` → `roundSettlement` → `pilesCheck`), give the same cash per
 *   tapper and the same owner transfer as the plan (no money rule changed).
 *
 * Deterministic: a fixed-seed LCG, so a failure always reproduces.
 */

import { describe, expect, it } from 'vitest';

import { closeoutPlan, confirmWrites, netDraft, sourcesSheet, REPAY_ROUTES, type CloseoutWorkerDraft, type CloseoutWorkerInput, type RepayRoute } from './closeout';
import { pilesCheck, workerCash } from './deduct';
import type { Reimbursement } from './ledger';
import { roundSettlement } from './rounding';
import { FARM_FUNDS, type DebtPaymentFields } from './types';

const CASES = 2000;

function lcg(seed: number) {
  let s = seed;
  return (n: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % n;
  };
}

describe('closeout fuzz (seeded)', () => {
  it(`${CASES} random sales: Σ = sale, and the recorded lines reproduce the plan under the old formulas`, () => {
    const rnd = lcg(12345);
    let checked = 0;
    for (let k = 0; k < CASES; k++) {
      const nw = 1 + rnd(4);
      const workers: CloseoutWorkerInput[] = Array.from({ length: nw }, (_, i) => ({
        id: `w${i}`,
        name: `w${i}`,
        shareSatang: rnd(3) ? rnd(2000000) : rnd(1000),
        balanceSatang: rnd(3) ? rnd(3000000) : 0,
        planPerSaleSatang: rnd(3) ? null : rnd(500000),
        owedBackSatang: rnd(2) ? rnd(100000) : 0,
        recorded: null,
      }));
      const owner = rnd(3000000);
      const sale = owner + workers.reduce((a, w) => a + w.shareSatang, 0);
      const routes: Record<string, RepayRoute> = Object.fromEntries(workers.map((w) => [w.id, REPAY_ROUTES[rnd(3)]]));
      const rounding = (['worker', 'none', 'owner'] as const)[rnd(3)];
      const plan = (drafts: Record<string, CloseoutWorkerDraft>) =>
        closeoutPlan({ saleTotalSatang: sale, ownerShareSatang: owner, workers, drafts, defaultRoute: (id) => routes[id], rounding });

      // Typed totals first, then partial netting through netDraft, as the sheets do.
      const drafts: Record<string, CloseoutWorkerDraft> = {};
      for (const w of plan(drafts).workers) if (rnd(2)) drafts[w.id] = { totalSatang: rnd(w.capSatang + 1) };
      for (const w of plan(drafts).workers) {
        if (w.netCapSatang > 0 && rnd(2)) {
          const d = netDraft(w, rnd(w.netCapSatang + 1));
          if (d) drafts[w.id] = { ...drafts[w.id], ...d };
        }
      }
      const p = plan(drafts);
      if (p.anyInvalid) continue;
      checked += 1;

      const src = sourcesSheet(p, sale, owner);
      expect({ k, tally: p.tally.ok, shares: src.shares.ok, debt: src.debt.ok, rounding: src.rounding.ok, paid: src.paid.ok }).toEqual({ k, tally: true, shares: true, debt: true, rounding: true, paid: true });

      // The old pipeline, from the lines confirm would write.
      let id = 0;
      const before = p.workers.map((w) => {
        const owed = [{ expenseId: 'x', to: { id: w.id, name: w.name }, originalSatang: 1e9, repaidSatang: 0, remainingSatang: 1e9, date: '2026-01-01', status: 'owed', repayments: [] } as unknown as Reimbursement];
        const r = confirmWrites({ saleId: 'S', date: '2026-10-31', worker: { id: w.id, name: w.name }, farm: { id: FARM_FUNDS, name: '' }, plan: w, recorded: [], owed, newId: (prefix) => `${prefix}${++id}` });
        if (!r.ok) throw new Error(`case ${k}: confirmWrites refused a valid plan`);
        const pays = r.writes.flatMap((x) => (x.op === 'write' && x.payload.t === 'debt_payment_recorded' ? [x.payload.fields as DebtPaymentFields] : []));
        const ded = pays.filter((f) => f.method !== 'netting').reduce((a, f) => a + f.amountSatang, 0);
        const net = pays.filter((f) => f.method === 'netting').reduce((a, f) => a + f.amountSatang, 0);
        return { id: w.id, pays, cashBeforeSatang: workerCash({ shareSatang: w.shareSatang, deductionSatang: ded + net, nettingSatang: net, adjustSatang: 0 }) };
      });
      const res = roundSettlement(before, p.hasFraction ? rounding : 'none', owner);
      const sum = (m: string) =>
        before
          .flatMap((b) => b.pays)
          .filter((f) => f.method === m)
          .reduce((a, f) => a + f.amountSatang, 0);
      const ownerTransfer = res.ownerSatang + sum('transfer-with-owner');
      const piles = pilesCheck([...res.workers.map((w) => ({ satang: w.cashSatang })), { satang: ownerTransfer }, { satang: sum('cash-from-share') }, { satang: sum('buyer-split') }], sale);
      expect(piles.ok).toBe(true);
      expect(res.workers.map((w) => w.cashSatang)).toEqual(p.workers.map((w) => w.cashSatang));
      expect(ownerTransfer).toBe(p.transferSatang);
    }
    // The generator must actually exercise valid plans, not skip them all.
    expect(checked).toBeGreaterThan(CASES / 2);
  });
});
