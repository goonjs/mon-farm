/**
 * E06-S08 · lead's condition (2026-11-01): the ledger's cross-sale reader
 * (`pendingRepayLines`, from the log) must say exactly what E05-S11's
 * per-sale rule says (`pendingRepays(closeoutPlan(...))`) — so the two never
 * drift apart. A seeded fuzz over the close-out generator of
 * closeout.fuzz.test.ts: random tappers, debts, plans, owed money, routes,
 * typed and netted amounts; the lines `confirmWrites` records go into a log
 * with random ticks (owner transfer, debt-cash per worker); for every valid
 * plan both sides give the same (worker, amount, transfer | cash) set.
 */

import { describe, expect, it } from 'vitest';

import { closeoutPlan, confirmWrites, netDraft, pendingRepays, REPAY_ROUTES, type CloseoutWorkerDraft, type CloseoutWorkerInput, type RepayRoute } from './closeout';
import { projectDebts } from './debts';
import type { Reimbursement } from './ledger';
import { OWNER_PAYEE, paymentMarkPayload, paymentTarget } from './payments';
import { debtCashPayee, pendingRepayLines } from './pending-repays';
import { FARM_FUNDS, type FinanceEvent, type FinancePayload } from './types';

const CASES = 1500;

function lcg(seed: number) {
  let s = seed;
  return (n: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % n;
  };
}

let n = 0;
const ev = (targetId: string, payload: FinancePayload): FinanceEvent => {
  n += 1;
  return { id: `q${n}`, groupId: 'g', deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: 'd' }, source: 'app', targetId, baseEventId: null, payload };
};

describe('pendingRepayLines ≡ pendingRepays(closeoutPlan) (E06-S08, lead condition 1)', () => {
  it(`${CASES} random sales with random ticks: the same workers, amounts and routes`, () => {
    const rnd = lcg(4242);
    let checked = 0;
    let nonEmpty = 0;
    for (let k = 0; k < CASES; k++) {
      const saleId = `S${k}`;
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
      const routes: Record<string, RepayRoute> = Object.fromEntries(workers.map((w) => [w.id, REPAY_ROUTES[rnd(3)]]));
      const rounding = (['worker', 'none', 'owner'] as const)[rnd(3)];
      const plan = (drafts: Record<string, CloseoutWorkerDraft>) =>
        closeoutPlan({ saleTotalSatang: sale, ownerShareSatang: owner, workers, drafts, defaultRoute: (id) => routes[id], rounding });
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

      // The log: what confirm records for each worker, then random ticks.
      const events: FinanceEvent[] = [];
      let id = 0;
      for (const w of workers) {
        if (w.balanceSatang > 0) {
          events.push(ev(`debt-${k}-${w.id}`, { t: 'debt_added', fields: { worker: { id: w.id, name: w.name }, kind: 'loan', amountSatang: w.balanceSatang, date: '2026-10-01', note: '', lender: { id: FARM_FUNDS, name: '' }, fertilizer: null, carriedForward: false } }));
        }
      }
      for (const w of p.workers) {
        const owed = [{ expenseId: 'x', to: { id: w.id, name: w.name }, originalSatang: 1e9, repaidSatang: 0, remainingSatang: 1e9, date: '2026-01-01', status: 'owed', repayments: [] } as unknown as Reimbursement];
        const r = confirmWrites({ saleId, date: '2026-11-05', worker: { id: w.id, name: w.name }, farm: { id: FARM_FUNDS, name: '' }, plan: w, recorded: [], owed, newId: (prefix) => `${prefix}${k}-${++id}` });
        if (!r.ok) throw new Error(`case ${k}: confirmWrites refused a valid plan`);
        for (const x of r.writes) if (x.op === 'write' && x.payload.t === 'debt_payment_recorded') events.push(ev(x.id, x.payload));
      }
      const ownerTicked = rnd(3) === 0;
      const cashTicked = new Set(p.workers.filter(() => rnd(3) === 0).map((w) => w.id));
      if (ownerTicked) events.push(ev(paymentTarget(saleId, OWNER_PAYEE), paymentMarkPayload(saleId, OWNER_PAYEE, true, p.transferSatang)));
      for (const wid of cashTicked) events.push(ev(paymentTarget(saleId, debtCashPayee(wid)), paymentMarkPayload(saleId, debtCashPayee(wid), true, 1)));

      const theirs = pendingRepays(p, { owner: ownerTicked, debtCash: (wid) => cashTicked.has(wid) })
        .map((x) => `${x.workerId}:${x.satang}:${x.how}`)
        .sort();
      const mine = pendingRepayLines(events, projectDebts(events))
        .map((l) => `${l.workerId}:${l.satang}:${l.how === 'transfer' ? 'transfer' : 'cash'}`)
        .sort();
      expect({ k, lines: mine }).toEqual({ k, lines: theirs });
      if (theirs.length) nonEmpty += 1;
    }
    expect(checked).toBeGreaterThan(CASES / 2);
    expect(nonEmpty).toBeGreaterThan(CASES / 4);
  });
});
