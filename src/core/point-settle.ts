/**
 * Settlement of a point sale, per tapper (E05-S01 on the point model,
 * E04-S01): every live basket belongs to its point's tapper on the sale day
 * (SALE-4), and each tapper's share is the one in force that day (MD-8; none
 * set = 50/50). The result has `settle()`'s shape so every money screen reads
 * one type; here a "zone" row is one tapper, the unit the split applies to.
 *
 * Same rounding rule as `settle()`: each tapper's gross is rounded once from
 * their own net weight, the sale gross is the sum, and the tapper takes the
 * remainder of the owner's share — so every figure adds up to the satang.
 */

import { shareOn, tapperOn, type MasterState } from './master';
import { SettlementUnavailable, formatBaht, formatKg, type Settlement, type WorkerSettlement, type ZoneSettlement } from './settle';
import { addTotals, liveBaskets, subsetTotals, ZERO_TOTALS } from './totals';
import type { Deduction, PersonId, SaleEvent, SaleState } from './types';

/** A sale recorded on weighing points: some basket carries a `pointId`. */
export function isPointSale(events: readonly SaleEvent[]): boolean {
  return events.some((e) => (e.kind === 'accept' || e.kind === 'short') && !!e.pointId);
}

/** Points with live baskets but no tapper on the sale day — settlement waits for them (D-63). */
export function unassignedPoints(events: readonly SaleEvent[], master: MasterState, day: string): string[] {
  const out = new Set<string>();
  for (const b of liveBaskets(events)) if (b.pointId && !tapperOn(master, b.pointId, day)) out.add(b.pointId);
  return [...out];
}

export function settlePoints(events: readonly SaleEvent[], state: SaleState, master: MasterState, day: string): Settlement {
  if (!state.price) throw new SettlementUnavailable('No agreed price. A sale cannot be settled against a price nobody recorded.');
  // A pile basket has no point and so no tapper: settling without it would drop its weight (review #7).
  if (liveBaskets(events).some((b) => !b.pointId)) {
    throw new SettlementUnavailable('This sale mixes point baskets with pile baskets; it cannot be settled per tapper.');
  }
  const missing = unassignedPoints(events, master, day);
  if (missing.length) throw new SettlementUnavailable(`Points with no tapper on ${day}: ${missing.join(', ')} (D-63).`);
  const { satangPerKg } = state.price;

  // Each tapper's points, in the order they first weighed.
  const pointsOf = new Map<PersonId, Set<string>>();
  for (const b of liveBaskets(events)) {
    if (!b.pointId) continue;
    const who = tapperOn(master, b.pointId, day)!;
    pointsOf.set(who, (pointsOf.get(who) ?? new Set()).add(b.pointId));
  }
  const nameOf = (id: PersonId) => master.people.find((p) => p.id === id)?.name ?? '';

  const perZone: ZoneSettlement[] = [...pointsOf].map(([personId, points]) => {
    const totals = subsetTotals(events, [...points]);
    const ownerPct = shareOn(master, personId, day).ownerPct;
    const grossSatang = Math.round((totals.netG * satangPerKg) / 1000);
    const ownerSatang = Math.round((grossSatang * ownerPct) / 100);
    return {
      zoneId: `tapper:${personId}`,
      zoneName: nameOf(personId),
      personId,
      workerName: nameOf(personId),
      ownerPct,
      fromSaleDefault: false,
      totals,
      grossSatang,
      ownerSatang,
      workerSatang: grossSatang - ownerSatang,
    };
  });

  // Old S29 deductions still come off a worker's own share, as in settle().
  const live = state.deductions.filter((d) => !d.voided);
  const perWorker: WorkerSettlement[] = perZone.map((z) => worker(z.personId!, z.workerName ?? '', [z.zoneId], z.workerSatang, live));
  for (const d of live) {
    if (!pointsOf.has(d.personId) && !perWorker.some((w) => w.personId === d.personId)) perWorker.push(worker(d.personId, d.personName, [], 0, live));
  }

  const totals = perZone.reduce((t, z) => addTotals(t, z.totals), ZERO_TOTALS);
  const grossSatang = perZone.reduce((s, z) => s + z.grossSatang, 0);
  return {
    totals,
    satangPerKg,
    grossSatang,
    ownerSatang: perZone.reduce((s, z) => s + z.ownerSatang, 0),
    workerSatang: perZone.reduce((s, z) => s + z.workerSatang, 0),
    perZone,
    perWorker,
    steps: [
      { key: 'baskets', thai: `${totals.baskets} เข่ง`, english: `${totals.baskets} baskets`, value: String(totals.baskets) },
      { key: 'net-weight', thai: 'น้ำหนักยางสุทธิ', english: 'net rubber', value: `${formatKg(totals.netG)} กก.` },
      { key: 'gross', thai: `× ${formatBaht(satangPerKg)} ต่อ กก.`, english: `× ${formatBaht(satangPerKg)} per kg`, value: formatBaht(grossSatang) },
    ],
  };
}

function worker(personId: PersonId, workerName: string, zoneIds: string[], workerSatang: number, live: readonly Deduction[]): WorkerSettlement {
  const deductions = live.filter((d) => d.personId === personId);
  const deductionSatang = deductions.reduce((s, d) => s + d.satang, 0);
  return { personId, workerName, zoneIds, workerSatang, deductions, deductionSatang, payoutSatang: workerSatang - deductionSatang };
}
