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

import { closeoutPlan, confirmWrites, netDraft, sourcesSheet, REPAY_ROUTES, type CloseoutWorkerDraft, type CloseoutWorkerInput, type RecordedLine, type RepayRoute } from './closeout';
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

  /*
   * Independent invariants (re-review 2): written from the D-60 / D-18 rules
   * themselves, not through deductSheet / roundSettlement / pilesCheck.
   */
  it(`${CASES} random sales: cash = share − route + adjust ≥ 0; 0 ≤ total ≤ min(balance, share + netting); Σ adjust + owner adjust = 0; debt left = balance − total`, () => {
    const rnd = lcg(777);
    let checked = 0;
    for (let k = 0; k < CASES; k++) {
      const workers: CloseoutWorkerInput[] = Array.from({ length: 1 + rnd(4) }, (_, i) => ({
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
      const rounding = (['worker', 'none', 'owner'] as const)[rnd(3)];
      const drafts: Record<string, CloseoutWorkerDraft> = {};
      // Any typed amounts at all (the invariants must hold whenever the plan says valid).
      for (const w of workers) if (rnd(2)) drafts[w.id] = { totalSatang: rnd(4000000), ...(rnd(3) === 0 ? { nettingSatang: rnd(120000) } : {}) };
      const p = closeoutPlan({ saleTotalSatang: sale, ownerShareSatang: owner, workers, drafts, defaultRoute: () => REPAY_ROUTES[rnd(3)], rounding });
      for (const [i, w] of p.workers.entries()) {
        const input = workers[i];
        if (w.invalid) continue;
        checked += 1;
        const route = w.totalSatang - w.nettingSatang;
        expect({ k, w: w.id, routeIs: w.routeSatang }).toEqual({ k, w: w.id, routeIs: route });
        expect({ k, w: w.id, cash: w.cashSatang }).toEqual({ k, w: w.id, cash: input.shareSatang - route + w.adjustSatang });
        expect(w.cashSatang).toBeGreaterThanOrEqual(0);
        expect(w.totalSatang).toBeGreaterThanOrEqual(0);
        expect(w.nettingSatang).toBeGreaterThanOrEqual(0);
        expect(w.nettingSatang).toBeLessThanOrEqual(Math.min(input.owedBackSatang, input.balanceSatang));
        expect(w.totalSatang).toBeLessThanOrEqual(Math.min(input.balanceSatang, input.shareSatang + w.nettingSatang));
        expect(w.debtLeftSatang).toBe(input.balanceSatang - w.totalSatang);
        // rounding moves less than a baht per worker (never a whole baht)
        expect(Math.abs(w.adjustSatang)).toBeLessThan(100);
      }
      if (!p.anyInvalid) expect(p.workers.reduce((a, w) => a + w.adjustSatang, 0) + (p.ownerSatang - owner)).toBe(0);
    }
    expect(checked).toBeGreaterThan(CASES / 2);
  });

  /**
   * Re-edit: lines recorded from a first plan (sometimes by TWO devices, owner
   * 2026-11-01 (A)), then a second draft. Applying confirmWrites' writes must
   * leave exactly the second plan's lines — netting total, route total on the
   * plan's route — and every line from one device; nothing of the first set
   * survives a rewrite, and a voided netting line takes its repayment along.
   */
  it(`${CASES} re-edits: confirmWrites leaves exactly the second plan's lines, from one device`, () => {
    const rnd = lcg(4242);
    let rewrites = 0;
    for (let k = 0; k < CASES; k++) {
      const share = rnd(2000000);
      const balance = 1 + rnd(3000000);
      const owedBack = rnd(2) ? rnd(100000) : 0;
      const base: CloseoutWorkerInput = { id: 'w', name: 'w', shareSatang: share, balanceSatang: balance, planPerSaleSatang: rnd(2) ? null : rnd(500000), owedBackSatang: owedBack, recorded: null };
      const routeA = REPAY_ROUTES[rnd(3)];
      const owed = [{ expenseId: 'x', to: { id: 'w', name: 'w' }, originalSatang: 1e9, repaidSatang: 0, remainingSatang: 1e9, date: '2026-01-01', status: 'owed', repayments: [] } as unknown as Reimbursement];
      let id = 0;
      const newId = (prefix: string) => `${prefix}${++id}`;
      const planOf = (input: CloseoutWorkerInput, draft: CloseoutWorkerDraft, route: RepayRoute) =>
        closeoutPlan({ saleTotalSatang: share + 100, ownerShareSatang: 100, workers: [input], drafts: { w: draft }, defaultRoute: () => route, rounding: 'none' }).workers[0];
      const firstDraft = (): CloseoutWorkerDraft => {
        const p0 = planOf(base, {}, routeA);
        const d: CloseoutWorkerDraft = { totalSatang: rnd(p0.capSatang + 1) };
        const p1 = planOf(base, d, routeA);
        const n = p1.netCapSatang > 0 && rnd(2) ? netDraft(p1, rnd(p1.netCapSatang + 1)) : null;
        return n ? { ...d, ...n } : d;
      };
      // Lines as the log would hold them after one or two devices' confirms (each from nothing recorded).
      let lines: (RecordedLine & { repLive?: boolean })[] = [];
      const devices = rnd(3) === 0 ? ['A', 'B'] : ['A'];
      for (const dev of devices) {
        const p1 = planOf(base, firstDraft(), routeA);
        if (p1.invalid) continue;
        const r = confirmWrites({ saleId: 'S', date: 'd', worker: { id: 'w', name: 'w' }, farm: { id: FARM_FUNDS, name: '' }, plan: p1, recorded: [], owed, newId });
        if (!r.ok) throw new Error(`case ${k}: first confirm refused`);
        for (const x of r.writes)
          if (x.op === 'write' && x.payload.t === 'debt_payment_recorded') {
            const f = x.payload.fields as DebtPaymentFields;
            lines.push({ id: x.id, headEventId: `h-${x.id}`, method: f.method, amountSatang: f.amountSatang, repaymentId: f.repaymentId, repaymentHead: f.repaymentId ? `h-${f.repaymentId}` : undefined, deviceId: dev });
          }
      }
      const total = lines.reduce((a, l) => a + l.amountSatang, 0);
      const net = lines.filter((l) => l.method === 'netting').reduce((a, l) => a + l.amountSatang, 0);
      const recRoute = (lines.find((l) => l.method !== 'netting')?.method ?? null) as RepayRoute | null;
      const input: CloseoutWorkerInput = { ...base, recorded: lines.length ? { totalSatang: total, nettingSatang: net, route: recRoute } : null, devices: new Set(lines.map((l) => l.deviceId)).size };
      // The second draft, as the owner types it in the sheet.
      const routeB = REPAY_ROUTES[rnd(3)];
      const p0 = planOf(input, { route: routeB }, routeB);
      const d2: CloseoutWorkerDraft = { route: routeB, totalSatang: rnd(Math.max(1, p0.capSatang + 1)) };
      const p2a = planOf(input, d2, routeB);
      const n2 = p2a.netCapSatang > 0 && rnd(2) ? netDraft(p2a, rnd(p2a.netCapSatang + 1)) : rnd(2) ? { nettingSatang: 0, totalSatang: d2.totalSatang ?? 0 } : null;
      const p2 = planOf(input, n2 ? { ...d2, ...n2 } : d2, routeB);
      if (p2.invalid) continue;
      const r = confirmWrites({ saleId: 'S', date: 'd', worker: { id: 'w', name: 'w' }, farm: { id: FARM_FUNDS, name: '' }, plan: p2, recorded: lines, owed, newId: (prefix) => `${prefix}C${++id}` });
      if (!r.ok) throw new Error(`case ${k}: second confirm refused`);
      if (r.writes.length) rewrites += 1;
      const voidedPay = new Set(r.writes.filter((x) => x.op === 'void-payment').map((x) => x.id));
      const voidedRep = new Set(r.writes.filter((x) => x.op === 'void-repayment').map((x) => x.id));
      for (const l of lines) if (voidedPay.has(l.id) && l.repaymentId) expect(voidedRep.has(l.repaymentId)).toBe(true);
      lines = [
        ...lines.filter((l) => !voidedPay.has(l.id)),
        ...r.writes.flatMap((x) => (x.op === 'write' && x.payload.t === 'debt_payment_recorded' ? [{ id: x.id, headEventId: '', method: (x.payload.fields as DebtPaymentFields).method, amountSatang: (x.payload.fields as DebtPaymentFields).amountSatang, deviceId: 'C' }] : [])),
      ];
      // Every write is for this worker and this sale, and no old line survives next to a new one.
      if (r.writes.length) expect(lines.every((l) => l.deviceId === 'C')).toBe(true);
      expect(new Set(lines.map((l) => l.deviceId)).size).toBeLessThanOrEqual(1);
      const netLines = lines.filter((l) => l.method === 'netting');
      const routeLines = lines.filter((l) => l.method !== 'netting');
      expect({ k, net: netLines.reduce((a, l) => a + l.amountSatang, 0), route: routeLines.reduce((a, l) => a + l.amountSatang, 0) }).toEqual({ k, net: p2.nettingSatang, route: p2.routeSatang });
      for (const l of routeLines) expect(l.method).toBe(p2.route);
      // confirming the same plan again writes nothing
      const again = confirmWrites({ saleId: 'S', date: 'd', worker: { id: 'w', name: 'w' }, farm: { id: FARM_FUNDS, name: '' }, plan: p2, recorded: lines, owed, newId });
      expect(again).toEqual({ ok: true, writes: [] });
    }
    expect(rewrites).toBeGreaterThan(CASES / 4);
  });
});
